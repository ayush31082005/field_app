import { Request, Response } from 'express';
import {
  findAllCases,
  getWorkflow,
  reviewAllDocuments,
  saveWorkflowAction,
  updateDocumentReview,
  assignCaseToFieldVerification,
  claimCase,
  heartbeatCase,
  releaseCase,
  userOwnsCase,
  addCaseHistory,
  getCaseHistory,
} from '../../models/fcuModels/casesModel';
import { findFcuUserByEmail } from '../../models/fcuModels/authModel';
import { sendWhatsAppRejection } from '../../utils/whatsapp';

const REQUIRED_DOCUMENTS = ['aadhaar', 'pan', 'bank', 'selfie'];

const parseApplicationId = (value: string | string[]) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const numericId = Number(String(raw).replace(/^APP0*/i, ''));
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
};

export const getCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const cases = await findAllCases();
    const currentUserId = Number((req as any).fcuUser?.id);
    res.json({ status: 'success', data: cases.map(item => ({ ...item, lock: item.lock ? { ...item.lock, isMine: item.lock.userId === currentUserId } : null })) });
  } catch (error) {
    console.error('FCU cases error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load FCU applications' });
  }
};

export const claimCaseForReview = async (req: Request, res: Response): Promise<void> => {
  const applicationId = parseApplicationId(req.params.caseId);
  if (!applicationId) { res.status(400).json({ status: 'error', message: 'Invalid application' }); return; }
  const result = await claimCase(applicationId, Number((req as any).fcuUser.id));
  if (!result.claimed) { res.status(409).json({ status: 'error', message: `This application is being reviewed by ${result.owner}`, data: result }); return; }
  res.json({ status: 'success', data: { applicationId, expiresInMinutes: 15 } });
};

export const keepCaseClaimAlive = async (req: Request, res: Response): Promise<void> => {
  const applicationId = parseApplicationId(req.params.caseId);
  if (!applicationId || !(await heartbeatCase(applicationId, Number((req as any).fcuUser.id)))) { res.status(409).json({ status: 'error', message: 'Your review lock expired or belongs to another user' }); return; }
  res.json({ status: 'success' });
};

export const releaseCaseReview = async (req: Request, res: Response): Promise<void> => {
  const applicationId = parseApplicationId(req.params.caseId);
  if (!applicationId) { res.status(400).json({ status: 'error', message: 'Invalid application' }); return; }
  await releaseCase(applicationId, Number((req as any).fcuUser.id));
  res.json({ status: 'success' });
};

const ensureCaseOwner = async (req: Request, res: Response, applicationId: number) => {
  if (await userOwnsCase(applicationId, Number((req as any).fcuUser.id))) return true;
  res.status(409).json({ status: 'error', message: 'Claim this application before making changes, or your review lock has expired' });
  return false;
};

export const reviewDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseApplicationId(req.params.caseId);
    const documentId = String(req.params.documentId);
    const status = String(req.body.status || '').toUpperCase();
    if (!applicationId || !REQUIRED_DOCUMENTS.includes(documentId) || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ status: 'error', message: 'Invalid application, document or review status' });
      return;
    }
    if (!(await ensureCaseOwner(req, res, applicationId))) return;
    await updateDocumentReview(applicationId, documentId, status as 'APPROVED' | 'REJECTED');
    await addCaseHistory(applicationId, 'DOCUMENT_REVIEW', `${documentId.toUpperCase()} document ${status.toLowerCase()}`, `Document review status changed to ${status}.`, Number((req as any).fcuUser.id));
    res.json({ status: 'success', data: { documentId, status } });
  } catch (error) {
    console.error('FCU document review error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to save document review' });
  }
};

export const approveAllDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseApplicationId(req.params.caseId);
    if (!applicationId) {
      res.status(400).json({ status: 'error', message: 'Invalid application' });
      return;
    }
    if (!(await ensureCaseOwner(req, res, applicationId))) return;
    await reviewAllDocuments(applicationId, REQUIRED_DOCUMENTS);
    await addCaseHistory(applicationId, 'DOCUMENT_REVIEW', 'All documents approved', 'All required documents were approved.', Number((req as any).fcuUser.id));
    res.json({ status: 'success', data: { documents: REQUIRED_DOCUMENTS, status: 'APPROVED' } });
  } catch (error) {
    console.error('FCU approve all error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to approve documents' });
  }
};

export const performWorkflowAction = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseApplicationId(req.params.caseId);
    const action = String(req.body.action || '').toUpperCase();
    if (!applicationId) {
      res.status(400).json({ status: 'error', message: 'Invalid application' });
      return;
    }
    if (!(await ensureCaseOwner(req, res, applicationId))) return;

    const workflow = await getWorkflow(applicationId);
    const currentCase = (await findAllCases()).find(item => item.databaseId === applicationId);
    const allDocumentsApproved = Boolean(currentCase?.docs?.length) && currentCase.docs.every((document: any) => document.status === 'APPROVED');
    const allEkycChecksPassed = Boolean(currentCase?.checks?.length) && currentCase.checks.every((check: any) => check.status === 'PASS');
    const sessionUser = (req as any).fcuUser;
    const reviewer = await findFcuUserByEmail(sessionUser.email);
    if (!reviewer || reviewer.status !== 'active') {
      res.clearCookie('fcu_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      res.status(401).json({
        status: 'error',
        message: 'Your session belongs to an old database user. Please sign in again.',
        code: 'STALE_FCU_SESSION',
      });
      return;
    }

    let nextStage = workflow.stage;
    let caseStatus = workflow.case_status || 'PENDING';
    let fieldAssignedTo: string | undefined;

    if (action === 'APPROVE_CASE' || action === 'REJECT_CASE') {
      if (!allDocumentsApproved || !allEkycChecksPassed || workflow.stage !== 'DOCUMENT_REVIEW') {
        res.status(409).json({
          status: 'error',
          message: !allDocumentsApproved
            ? 'All documents must be approved before this action'
            : !allEkycChecksPassed
              ? 'All eKYC checks must pass before approve or reject'
              : 'This case is no longer in document review',
        });
        return;
      }
      if (action === 'REJECT_CASE') {
        nextStage = 'FINALIZED';
        caseStatus = 'REJECTED';
      } else {
        nextStage = 'FCU_APPROVED';
        caseStatus = 'APPROVED';
      }
    } else if (action === 'SEND_FIELD' || action === 'WAIVE_FIELD') {
      if (workflow.stage !== 'FCU_APPROVED') {
        res.status(409).json({ status: 'error', message: 'Approve the case before choosing field verification' });
        return;
      }
      if (action === 'SEND_FIELD') {
        nextStage = 'FIELD_ASSIGNED';
        caseStatus = 'FIELD_VERIFICATION';
        fieldAssignedTo = 'Field Verification Team';
      } else {
        nextStage = 'FIELD_WAIVED';
        caseStatus = 'PENDING';
      }
    } else if (['SEND_CREDIT', 'HOLD_CASE', 'FORWARD_REJECT'].includes(action)) {
      const fieldReportComplete = Boolean(currentCase?.fieldReport)
        && Boolean(currentCase.fieldReport?.documents?.aadhaar)
        && Boolean(currentCase.fieldReport?.documents?.pan)
        && Array.isArray(currentCase.fieldReport?.documents?.checklist)
        && currentCase.fieldReport.documents.checklist.length === 5
        && currentCase.fieldReport.documents.checklist.every(Boolean)
        && Boolean(currentCase.fieldReport?.photos?.applicant)
        && Boolean(currentCase.fieldReport?.photos?.residenceOffice)
        && Boolean(currentCase.fieldReport?.location?.latitude)
        && Boolean(currentCase.fieldReport?.location?.longitude)
        && Boolean(currentCase.fieldReport?.signature);
      const verificationFinished = workflow.stage === 'FIELD_WAIVED'
        || (workflow.stage === 'FIELD_ASSIGNED' && fieldReportComplete);
      if (!verificationFinished) {
        res.status(409).json({ status: 'error', message: 'Final actions unlock after field verification is waived or a complete field report is submitted' });
        return;
      }
      nextStage = 'FINALIZED';
      caseStatus = action === 'SEND_CREDIT' ? 'SENT_TO_CREDIT' : action === 'HOLD_CASE' ? 'HOLD' : 'FORWARDED_REJECT';
    } else {
      res.status(400).json({ status: 'error', message: 'Unsupported FCU workflow action' });
      return;
    }

    await saveWorkflowAction(applicationId, nextStage, caseStatus, reviewer.id, fieldAssignedTo);
    const actionTitle: Record<string, string> = { APPROVE_CASE:'Case approved', REJECT_CASE:'Case rejected', SEND_FIELD:'Sent to field verification', WAIVE_FIELD:'Field verification waived', SEND_CREDIT:'Sent to credit team', HOLD_CASE:'Case placed on hold', FORWARD_REJECT:'Forwarded for rejection' };
    await addCaseHistory(applicationId, 'WORKFLOW_ACTION', actionTitle[action] || action, `Stage: ${nextStage} · Status: ${caseStatus}`, reviewer.id);
    let whatsapp: { sent: boolean; message?: string } | null = null;
    if (action === 'REJECT_CASE') {
      try {
        await sendWhatsAppRejection(String(currentCase?.mobile || ''), String(currentCase?.borrower || 'Customer'), String(currentCase?.id || `APP${applicationId}`));
        whatsapp = { sent: true };
        await addCaseHistory(applicationId, 'WHATSAPP', 'Rejection WhatsApp sent', `Rejection template sent to ${currentCase?.mobile || 'registered mobile'}.`, reviewer.id);
      } catch (notificationError: any) {
        whatsapp = { sent: false, message: notificationError?.message || 'WhatsApp notification failed' };
        await addCaseHistory(applicationId, 'WHATSAPP_FAILED', 'Rejection WhatsApp failed', whatsapp.message || 'WhatsApp notification failed', reviewer.id);
        console.error('FCU rejection WhatsApp error:', notificationError?.response?.data || notificationError);
      }
    }
    if (action === 'SEND_FIELD' && fieldAssignedTo) {
      await assignCaseToFieldVerification(applicationId, reviewer.id, fieldAssignedTo);
    }
    if (nextStage === 'FINALIZED' || nextStage === 'FIELD_ASSIGNED') await releaseCase(applicationId, Number((req as any).fcuUser.id));
    res.json({
      status: 'success',
      data: { workflowStage: nextStage, caseStatus, fieldAssignedTo: fieldAssignedTo || null, whatsapp },
    });
  } catch (error: any) {
    console.error('FCU workflow action error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to update FCU workflow',
      code: error?.code || 'FCU_WORKFLOW_ERROR',
      detail: process.env.NODE_ENV === 'production' ? undefined : (error?.sqlMessage || error?.message),
    });
  }
};

export const listCaseHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseApplicationId(req.params.caseId);
    if (!applicationId) { res.status(400).json({ status:'error', message:'Invalid application' }); return; }
    res.json({ status:'success', data: await getCaseHistory(applicationId) });
  } catch (error) {
    console.error('FCU case history error:', error);
    res.status(500).json({ status:'error', message:'Unable to load case history' });
  }
};

export const addCaseNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseApplicationId(req.params.caseId);
    const note = String(req.body.note || '').trim();
    if (!applicationId || !note || note.length > 1000) { res.status(400).json({ status:'error', message:'Enter a valid note (maximum 1000 characters)' }); return; }
    if (!(await ensureCaseOwner(req, res, applicationId))) return;
    const data = await addCaseHistory(applicationId, 'NOTE', 'Review note added', note, Number((req as any).fcuUser.id));
    res.status(201).json({ status:'success', data });
  } catch (error) {
    console.error('FCU case note error:', error);
    res.status(500).json({ status:'error', message:'Unable to save case note' });
  }
};
