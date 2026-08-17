import { Request, Response } from 'express';
import { assertFieldCaseOwnership, claimFieldCase, deleteFieldImageUpload, findAssignedFieldCases, findExistingFieldReport, findFieldHistory, findFieldImageUpload, saveFieldImageUpload, saveFieldReport } from '../../models/fieldModels/casesModel';
import axios from 'axios';

const saveDataImage = async (dataUrl: string, applicationId: number, fieldUserId: number, label: string) => {
  const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error: any = new Error(`Invalid ${label} image`);
    error.statusCode = 400;
    throw error;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error: any = new Error(`${label} image must be smaller than 5 MB`);
    error.statusCode = 400;
    throw error;
  }
  const extension = match[1] === 'jpg' ? 'jpeg' : match[1];
  return saveFieldImageUpload(applicationId, fieldUserId, label, `image/${extension}`, buffer);
};

const isStoredImagePath = (value: unknown) =>
  typeof value === 'string' && (
    /^\/api\/field\/auth\/images\/[0-9a-f-]{36}$/.test(value)
    || /^\/uploads\/field-verification\/application_\d+_[a-z_]+_\d+_[a-f0-9]+\.(jpeg|png|webp)$/.test(value)
  );

export const uploadFieldImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = Number(req.params.applicationId);
    const label = String(req.body.label || '').toLowerCase();
    const allowedLabels = ['aadhaar', 'pan', 'extra_document', 'applicant', 'residence_office'];
    if (!Number.isInteger(applicationId) || applicationId < 1 || !allowedLabels.includes(label)) {
      res.status(400).json({ status: 'error', message: 'Invalid application or image type' });
      return;
    }
    await assertFieldCaseOwnership(applicationId, (req as any).fieldUser.id);
    const saved = await saveDataImage(String(req.body.image || ''), applicationId, (req as any).fieldUser.id, label);
    res.status(201).json({ status: 'success', data: { path: saved.publicPath } });
  } catch (error: any) {
    console.error('Field image upload error:', error);
    res.status(error?.statusCode || 500).json({ status: 'error', message: error?.message || 'Unable to upload image' });
  }
};

export const getFieldImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageId = String(req.params.imageId || '').toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(imageId)) {
      res.status(400).json({ status: 'error', message: 'Invalid image ID' });
      return;
    }
    const image = await findFieldImageUpload(imageId, (req as any).fieldUser.id);
    if (!image) {
      res.status(404).json({ status: 'error', message: 'Image not found' });
      return;
    }
    res.setHeader('Content-Type', image.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(image.image_data);
  } catch (error) {
    console.error('Field image read error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load image' });
  }
};

export const getCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const cases = await findAssignedFieldCases((req as any).fieldUser.id);
    res.json({ status: 'success', data: cases });
  } catch (error) {
    console.error('Field cases error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load field verification cases' });
  }
};

export const startCase = async (req: Request, res: Response): Promise<void> => {
  const applicationId = Number(req.params.applicationId);
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    res.status(400).json({ status: 'error', message: 'Invalid application' });
    return;
  }
  try {
    const result = await claimFieldCase(applicationId, (req as any).fieldUser.id);
    if (result === 'unavailable') {
      res.status(409).json({ status: 'error', message: 'This case was already claimed by another field agent' });
      return;
    }
    res.json({ status: 'success', data: { status: 'pending' } });
  } catch (error) {
    console.error('Start field case error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to start field case' });
  }
};

export const getHistory = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ status: 'success', data: await findFieldHistory() });
  } catch (error) {
    console.error('Field history error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to load verification history' });
  }
};

export const reverseGeocode = async (req: Request, res: Response): Promise<void> => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    res.status(400).json({ status: 'error', message: 'Valid latitude and longitude are required' });
    return;
  }
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'jsonv2', addressdetails: 1, zoom: 18 },
      headers: { 'User-Agent': 'VerifyBharat-FieldVerification/1.0' },
      timeout: 10000,
    });
    res.json({ status: 'success', data: { address: response.data?.display_name || `${lat}, ${lng}` } });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(502).json({ status: 'error', message: 'Unable to resolve this location address' });
  }
};

export const getNetworkLocation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await axios.get('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'VerifyBharat-FieldVerification/1.0' },
      timeout: 10000,
    });
    const latitude = Number(response.data?.latitude);
    const longitude = Number(response.data?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Network location unavailable');
    const address = [response.data?.city, response.data?.region, response.data?.postal, response.data?.country_name].filter(Boolean).join(', ');
    res.json({ status: 'success', data: { latitude, longitude, accuracy: 10000, address, source: 'network' } });
  } catch (error) {
    console.error('Network location error:', error);
    res.status(502).json({ status: 'error', message: 'Unable to determine network location' });
  }
};

export const submitReport = async (req: Request, res: Response): Promise<void> => {
  const createdUploadIds: string[] = [];
  try {
    const applicationId = Number(req.params.applicationId);
    const { documents, photos, location, signature, outcome, remarks } = req.body;
    const isImage = (value: unknown) => (typeof value === 'string' && value.startsWith('data:image/')) || isStoredImagePath(value);
    const documentsComplete = isImage(documents?.aadhaar) && isImage(documents?.pan) && Array.isArray(documents?.checklist) && documents.checklist.length === 5 && documents.checklist.every(Boolean);
    const photosComplete = isImage(photos?.applicant) && isImage(photos?.residenceOffice);
    const locationComplete = Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude)) && String(location?.address || '').trim();
    if (!Number.isInteger(applicationId) || applicationId < 1) {
      res.status(400).json({ status: 'error', message: 'Invalid application' });
      return;
    }
    const existingReport = await findExistingFieldReport(applicationId, (req as any).fieldUser.id);
    if (existingReport) {
      res.status(200).json({ status: 'success', message: 'Field verification report was already submitted', data: { ...existingReport, alreadySubmitted: true } });
      return;
    }
    if (!documentsComplete || !photosComplete || !locationComplete || !isImage(signature) || !['positive', 'negative', 'refer'].includes(outcome) || !String(remarks || '').trim()) {
      res.status(400).json({ status: 'error', message: 'Complete every verification step before submitting the report' });
      return;
    }
    const reportId = `RPT-${applicationId}-${Date.now().toString(36).toUpperCase()}`;
    const saveImage = async (dataUrl: string, label: string) => {
      if (isStoredImagePath(dataUrl)) return dataUrl;
      const saved = await saveDataImage(dataUrl, applicationId, (req as any).fieldUser.id, label);
      createdUploadIds.push(saved.id);
      return saved.publicPath;
    };
    const storedDocuments = {
      aadhaar: await saveImage(documents.aadhaar, 'aadhaar'),
      pan: await saveImage(documents.pan, 'pan'),
      extraDocument: documents.extraDocument ? await saveImage(documents.extraDocument, 'extra_document') : null,
      checklist: documents.checklist,
    };
    const storedPhotos = {
      applicant: await saveImage(photos.applicant, 'applicant'),
      residenceOffice: await saveImage(photos.residenceOffice, 'residence_office'),
    };
    const storedSignature = await saveImage(signature, 'signature');
    await saveFieldReport(applicationId, (req as any).fieldUser.id, outcome, {
      reportId, documents: storedDocuments, photos: storedPhotos, location, signature: storedSignature, remarks: String(remarks).trim(), submittedAt: new Date().toISOString(),
    });
    res.status(201).json({ status: 'success', message: 'Field verification report submitted', data: { reportId, photos: storedPhotos } });
  } catch (error: any) {
    await Promise.all(createdUploadIds.map(id => deleteFieldImageUpload(id, (req as any).fieldUser.id).catch(() => undefined)));
    console.error('Submit field report error:', error);
    res.status(error?.statusCode || 500).json({ status: 'error', message: error?.message || 'Unable to submit field verification report' });
  }
};
