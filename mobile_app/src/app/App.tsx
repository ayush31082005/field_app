import { useEffect, useState, useRef } from "react";
import {
  Home, ClipboardList, Clock, User, Bell, ChevronRight, ChevronLeft,
  Camera, MapPin, FileText, CheckCircle, XCircle, Search,
  ArrowLeft, AlertCircle, Shield, LogOut, Navigation, Pen,
  Banknote, RefreshCw, Send, Eye, EyeOff, Globe, RotateCcw,
  Scan, Fingerprint, Crosshair, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "cases" | "history" | "profile";
type CaseStatus = "new" | "pending" | "in-progress" | "completed" | "rejected" | "referred";
type LoanType = "home" | "personal" | "gold" | "business" | "education";

interface VerificationCase {
  id: string;
  applicant: string;
  mobile: string;
  address: string;
  city: string;
  pinCode: string;
  loanType: LoanType;
  loanAmount: number;
  bankBranch: string;
  status: CaseStatus;
  assignedAt: string | null;
  dob: string;
  email: string;
  firstName: string;
  middleName: string;
  surname: string;
  alternateMobile: string;
  screenedBy: string;
  screenedOn: string;
  gender: string;
  panNumber: string;
  panVerified: boolean;
  aadhaarNumber: string;
  aadhaarVerified: boolean;
  state: string;
  residenceType: string;
  secondaryAddress: string;
  residenceVerification: Record<string, string>;
  income: number;
  employer: string;
  employmentType: string;
  employerType: string;
  designation: string;
  officialEmail: string;
  workAddress: string;
  workCity: string;
  workState: string;
  workPinCode: string;
  employedSince: string;
  officeVerification: Record<string, string>;
  gpsCoords: [number, number];
  applicationId?: number;
  leadNumber?: string | null;
  assignedTo?: string;
}

interface HistoryData {
  summary: { total: number; positive: number; negative: number; referred: number };
  items: Array<{ applicationId: number; caseId: string; reportId: string; applicant: string; loanAmount: number; loanType: LoanType; outcome: "positive" | "negative" | "refer"; status: CaseStatus; submittedAt: string; remarks: string; agent: string }>;
}

interface FieldUser {
  id: number;
  employeeId: string;
  name: string;
  role: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOAN_LABELS: Record<LoanType, string> = {
  home: "Home Loan",
  personal: "Personal Loan",
  gold: "Gold Loan",
  business: "Business Loan",
  education: "Education Loan",
};

const STATUS_STYLE: Record<CaseStatus, { label: string; classes: string }> = {
  new: { label: "New", classes: "text-orange-700 bg-orange-100 border-orange-300" },
  pending: { label: "Pending", classes: "text-amber-400 bg-amber-400/10 border-amber-400/25" },
  "in-progress": { label: "In Progress", classes: "text-amber-800 bg-amber-100 border-amber-300" },
  completed: { label: "Verified", classes: "text-black bg-yellow-300 border-yellow-500" },
  rejected: { label: "Rejected", classes: "text-white bg-black border-black" },
  referred: { label: "Referred", classes: "text-orange-900 bg-orange-200 border-orange-400" },
};

const VERIFICATION_STEPS = [
  "Applicant Info",
  "Documents",
  "Photo Capture",
  "GPS Location",
  "Signature",
  "Submit Report",
];

function fmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const DISPLAY = { fontFamily: "'Rozha One', serif" } as const;
const MONO = { fontFamily: "'DM Mono', monospace" } as const;

// ─── SVG Ornaments ────────────────────────────────────────────────────────────

function MandalaSVG({ size = 100, opacity = 0.15 }: { size?: number; opacity?: number }) {
  const cx = size / 2;
  const r = cx;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }}>
      {[1, 0.75, 0.5, 0.27].map((scale, i) => (
        <circle key={i} cx={cx} cy={cx} r={r * scale - (i === 0 ? 1 : 0)}
          fill="none" stroke="white" strokeWidth={i === 3 ? 0.9 : 0.4} />
      ))}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 16;
        return (
          <line key={i}
            x1={cx + Math.cos(a) * r * 0.27} y1={cx + Math.sin(a) * r * 0.27}
            x2={cx + Math.cos(a) * (r - 1)} y2={cx + Math.sin(a) * (r - 1)}
            stroke="white" strokeWidth="0.35" />
        );
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 8;
        const pr = r * 0.62;
        const px = cx + Math.cos(a) * pr;
        const py = cx + Math.sin(a) * pr;
        return (
          <ellipse key={i} cx={px} cy={py} rx={r * 0.1} ry={r * 0.22}
            transform={`rotate(${(a * 180) / Math.PI + 90}, ${px}, ${py})`}
            fill="none" stroke="white" strokeWidth="0.4" />
        );
      })}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 24;
        return (
          <circle key={i} cx={cx + Math.cos(a) * (r - 5)} cy={cx + Math.sin(a) * (r - 5)} r={1.2} fill="white" />
        );
      })}
    </svg>
  );
}

function LotusLogo({ size = 34, dark = false }: { size?: number; dark?: boolean }) {
  const fill = dark ? "#ffffff" : "#111111";
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI * 2) / 8 - Math.PI / 2;
        const pr = 8;
        const px = 18 + Math.cos(a) * pr;
        const py = 18 + Math.sin(a) * pr;
        return (
          <ellipse key={i} cx={px} cy={py} rx={3.5} ry={8}
            transform={`rotate(${(a * 180) / Math.PI + 90}, ${px}, ${py})`}
            fill={fill} opacity="0.95" />
        );
      })}
      <circle cx="18" cy="18" r="5" fill={fill} />
      <line x1="18" y1="26" x2="18" y2="30" stroke={fill} strokeWidth="1.5" />
      <line x1="14" y1="28" x2="18" y2="30" stroke={fill} strokeWidth="1" />
      <line x1="22" y1="28" x2="18" y2="30" stroke={fill} strokeWidth="1" />
    </svg>
  );
}

function GeetPayLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/geetpay-logo.png"
      alt="GeetPay — Product of Waqt Finance"
      className={`${compact ? "w-[92px]" : "w-[142px] sm:w-[158px]"} h-auto object-contain block`}
    />
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CaseStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={MONO} className={`text-[10px] px-2 py-0.5 rounded border ${s.classes} whitespace-nowrap`}>
      {s.label}
    </span>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="h-px flex-1 bg-border" />
      <div className="w-1 h-1 rounded-full bg-border" />
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────

function SignaturePad({ onSigned }: { onSigned: (value: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const [hasSig, setHasSig] = useState(false);

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = getXY(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getXY(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    last.current = pos;
    if (!hasSig) setHasSig(true);
  }

  function onUp() {
    if (!drawing.current) return;
    drawing.current = false;
    onSigned(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    setHasSig(false);
    onSigned(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative border border-border rounded-xl overflow-hidden bg-secondary">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-40 touch-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
        {!hasSig && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground">Draw signature here</p>
          </div>
        )}
        <div className="absolute bottom-10 left-4 right-4 border-t border-dashed border-border/60" />
        <div className="absolute bottom-3 left-4">
          <p style={MONO} className="text-[9px] text-muted-foreground">Applicant Signature</p>
        </div>
      </div>
      <button onClick={clear} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <RotateCcw size={12} /> Clear & Redo
      </button>
    </div>
  );
}

// ─── GPS Map Placeholder ──────────────────────────────────────────────────────

function GPSMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="relative bg-secondary border border-border rounded-xl overflow-hidden h-44">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 176" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="176" stroke="white" strokeWidth="0.4" opacity="0.15" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 44} x2="320" y2={i * 44} stroke="white" strokeWidth="0.4" opacity="0.15" />
        ))}
        <line x1="0" y1="0" x2="320" y2="176" stroke="white" strokeWidth="0.3" opacity="0.08" />
        <line x1="320" y1="0" x2="0" y2="176" stroke="white" strokeWidth="0.3" opacity="0.08" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border border-foreground/30 rounded-full" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-foreground rounded-full shadow-[0_0_12px_rgba(240,240,240,0.6)]" />
          </div>
          <div className="absolute top-1/2 -left-6 -right-6 h-px bg-foreground/30" />
          <div className="absolute left-1/2 -top-6 -bottom-6 w-px bg-foreground/30" />
          <div className="absolute inset-0 border border-foreground/10 rounded-full animate-ping" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-3">
        <p style={MONO} className="text-xs text-foreground">{lat.toFixed(4)}°N, {lng.toFixed(4)}°E</p>
        <p className="text-[10px] text-muted-foreground">±4m accuracy · GPS Lock Acquired</p>
      </div>
    </div>
  );
}

// ─── Camera Capture ───────────────────────────────────────────────────────────

function CameraCapture({ label, value, facingMode, onCapture }: { label: string; value: string | null; facingMode: "user" | "environment"; onCapture: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  async function openCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 0);
    } catch {
      setCameraError("Camera permission unavailable. Use device photo option below.");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 1024 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.75));
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.75));
    bitmap.close();
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
      <div
        onClick={() => { if (!cameraOpen) openCamera(); }}
        className={`relative h-40 rounded-xl border overflow-hidden transition-all cursor-pointer ${
          value ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-secondary hover:bg-accent active:scale-[0.99]"
        }`}
      >
        {cameraOpen ? (
          <><video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" /><button type="button" onClick={e => { e.stopPropagation(); takePhoto(); }} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white border-4 border-black/40 shadow-lg" aria-label="Capture photo" /></>
        ) : value ? (
          <><img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" /><div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 flex items-center justify-center gap-2 text-xs text-emerald-400"><CheckCircle size={14} /> Captured · Tap to retake</div></>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-20 h-20">
                {[
                  "top-0 left-0 border-t border-l",
                  "top-0 right-0 border-t border-r",
                  "bottom-0 left-0 border-b border-l",
                  "bottom-0 right-0 border-b border-r",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-5 h-5 border-foreground/50 ${cls}`} />
                ))}
              </div>
            </div>
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Camera size={12} /> Tap to capture
              </p>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" capture={facingMode} className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      </div>
      {cameraError && <div className="flex items-center justify-between gap-2 text-[10px] text-amber-400"><span>{cameraError}</span><button type="button" onClick={() => inputRef.current?.click()} className="underline whitespace-nowrap">Use device photo</button></div>}
    </div>
  );
}

// ─── Document Scan Item ───────────────────────────────────────────────────────

function DocScanItem({ title, subtitle, scanned, onScan }: {
  title: string; subtitle: string; scanned: string | null; onScan: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), []);

  async function openScanner() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      setScanning(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 0);
    } catch {
      setCameraError("Camera permission blocked. Allow camera access or use device photo.");
    }
  }

  function captureScan() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 1400 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    onScan(canvas.toDataURL("image/jpeg", 0.8));
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  function closeScanner() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function useFile(file?: File) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    onScan(canvas.toDataURL("image/jpeg", 0.8));
    bitmap.close();
  }

  return (
    <div className={`relative flex items-center gap-4 p-4 ${cameraError ? "mb-8" : ""} rounded-xl border transition-all ${
      scanned ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
        scanned ? "bg-emerald-500/15" : "bg-secondary"
      }`}>
        {scanned ? <img src={scanned} alt={`${title} scan`} className="w-full h-full object-cover" /> : <FileText size={20} className="text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {!scanning && (
        <button onClick={openScanner}
          className="flex items-center gap-1.5 text-xs bg-secondary px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-60 shrink-0"
        >
          <Scan size={11} /> {scanned ? "Rescan" : "Scan"}
        </button>
      )}
      {scanning && <div className="fixed inset-0 z-50 bg-black overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /><div className="absolute top-5 inset-x-0 text-center text-white text-sm font-medium">Scan {title}</div><button type="button" onClick={closeScanner} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 text-white text-xl" aria-label="Close camera">×</button><button type="button" onClick={captureScan} className="absolute bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-[6px] border-black/40 shadow-xl" aria-label={`Capture ${title}`} /></div>}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { useFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      {cameraError && <div className="absolute inset-x-3 -bottom-7 flex justify-between gap-2 text-[9px] text-amber-400"><span>{cameraError}</span><button type="button" className="underline whitespace-nowrap" onClick={() => inputRef.current?.click()}>Use photo</button></div>}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-card border-b border-border">
      {VERIFICATION_STEPS.map((_, i) => (
        <div key={i} className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${
          i <= current ? "bg-foreground" : "bg-border"
        }`} />
      ))}
    </div>
  );
}

// ─── Case Detail ──────────────────────────────────────────────────────────────

function CaseDetailScreen({ c, user, onBack, onSubmitted, onProgress }: { c: VerificationCase; user: FieldUser; onBack: () => void; onSubmitted: () => void; onProgress: (c: VerificationCase) => void }) {
  const [step, setStep] = useState(0);
  const [docs, setDocs] = useState<{ aadhaar: string | null; pan: string | null }>({ aadhaar: null, pan: null });
  const [extraDocument, setExtraDocument] = useState<string | null>(null);
  const [checklist, setChecklist] = useState([false, false, false, false, false]);
  const [photos, setPhotos] = useState<{ applicant: string | null; residenceOffice: string | null }>({ applicant: null, residenceOffice: null });
  const [gpsOk, setGpsOk] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number; address: string; source?: "gps" | "network" } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"positive" | "negative" | "refer" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [reportId, setReportId] = useState("");

  const canProceed = [
    true,
    Boolean(docs.aadhaar && docs.pan && checklist.every(Boolean) && (!['home', 'gold'].includes(c.loanType) || extraDocument)),
    Boolean(photos.applicant && photos.residenceOffice),
    gpsOk && Boolean(location?.address),
    Boolean(signature),
    outcome !== null && Boolean(remarks.trim()),
  ][step];

  async function uploadCapturedImage(image: string, label: string) {
    if (!c.applicationId) throw new Error("Application ID is missing.");
    setUploadError("");
    const response = await fetch(`/api/field/auth/cases/${c.applicationId}/images`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ image, label }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Image upload failed.");
    return result.data.path as string;
  }

  async function goToNextStep() {
    if (step === 0 && c.status === "new" && c.applicationId) {
      try {
        const response = await fetch(`/api/field/auth/cases/${c.applicationId}/start`, { method: "PATCH", credentials: "include" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Unable to start verification.");
        c = { ...c, status: "pending" };
        onProgress(c);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Unable to start verification.");
        return;
      }
    }
    setStep(current => current + 1);
  }

  async function captureAndStore(image: string, label: string, onStored: (path: string) => void) {
    try { onStored(await uploadCapturedImage(image, label)); }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Image upload failed."); }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) { setLocationError("Location is not supported by this browser."); return; }
    setLocating(true); setLocationError(""); setGpsOk(false);
    const getPosition = (options: PositionOptions) => new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    );
    try {
      let position: GeolocationPosition;
      try {
        // Network/cached location works more reliably on laptops without a GPS sensor.
        position = await getPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 });
      } catch (firstError: any) {
        if (firstError?.code === 1) throw firstError;
        position = await getPosition({ enableHighAccuracy: false, timeout: 30000, maximumAge: 0 });
      }
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, address: "" };
      const response = await fetch(`/api/field/auth/reverse-geocode?lat=${current.latitude}&lng=${current.longitude}`, { credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Address could not be found.");
      setLocation({ ...current, address: result.data.address, source: "gps" });
      setGpsOk(true);
    } catch (error: any) {
      if (error?.code === 2 || error?.code === 3) {
        try {
          const fallbackResponse = await fetch('/api/field/auth/network-location', { credentials: 'include' });
          const fallbackResult = await fallbackResponse.json().catch(() => ({}));
          if (!fallbackResponse.ok) throw new Error(fallbackResult.message || 'Network location unavailable');
          setLocation(fallbackResult.data);
          setGpsOk(true);
          setLocationError('GPS was unavailable, so an approximate network location is being used.');
          return;
        } catch {
          // Show the actionable device error below when both methods fail.
        }
      }
      const message = error?.code === 1
        ? "Location permission is blocked. Allow it from the address bar and reload."
        : error?.code === 2
          ? "Location is unavailable. Turn on Windows Location Services and Wi-Fi."
          : error?.code === 3
            ? "Location provider did not respond. Turn on Windows Location Services and try again."
            : (error?.message || "Unable to get current location.");
      setLocationError(message);
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!c.applicationId || !signature || !location || !photos.applicant || !photos.residenceOffice || !outcome || !remarks.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(`/api/field/auth/cases/${c.applicationId}/report`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ documents: { ...docs, extraDocument, checklist }, photos, location, signature, outcome, remarks: remarks.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Unable to submit report.");
      setReportId(result.data.reportId);
      if (result.data.outcome && ["positive", "negative", "refer"].includes(result.data.outcome)) {
        setOutcome(result.data.outcome);
      }
      setSubmitted(true);
      onSubmitted();
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "Unable to submit report."); }
    finally { setSubmitting(false); }
  }

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-1 -ml-1 text-foreground"><ArrowLeft size={20} /></button>
          <span className="text-sm font-medium text-foreground">Report Submitted</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="relative mb-6">
            <MandalaSVG size={130} opacity={0.12} />
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle size={44} className={
                outcome === "positive" ? "text-emerald-400" :
                outcome === "negative" ? "text-rose-400" : "text-violet-400"
              } />
            </div>
          </div>
          <h2 style={DISPLAY} className="text-2xl text-foreground">
            {outcome === "positive" ? "Verification Positive" : outcome === "negative" ? "Verification Negative" : "Case Referred"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{c.applicant}</p>
          <p style={MONO} className="text-xs text-muted-foreground mt-0.5">{c.id}</p>
          <div className="mt-6 bg-card border border-border rounded-2xl p-4 w-full text-left space-y-2.5">
            {[
              { k: "Submitted", v: new Date().toLocaleString("en-IN") },
              { k: "Agent", v: `${user.name} · ${user.employeeId}` },
              { k: "Outcome", v: outcome === "positive" ? "Positive" : outcome === "negative" ? "Negative" : "Referred" },
              { k: "Report ID", v: reportId },
            ].map((row) => (
              <div key={row.k} className="flex justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{row.k}</span>
                <span style={MONO} className="text-foreground text-right">{row.v}</span>
              </div>
            ))}
          </div>
          {remarks && (
            <div className="mt-3 bg-secondary border border-border rounded-xl p-3 w-full text-left">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Remarks</p>
              <p className="text-xs text-foreground">{remarks}</p>
            </div>
          )}
          <button onClick={onBack} className="mt-6 w-full bg-foreground text-background py-3.5 rounded-2xl text-sm font-semibold hover:bg-foreground/90 transition-colors">
            Back to Cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-foreground"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{c.applicant}</p>
          <p style={MONO} className="text-[10px] text-muted-foreground">{c.id}</p>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <StepBar current={step} />

      {/* Step label */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-card/50">
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Step {step + 1} of {VERIFICATION_STEPS.length}</p>
        <p style={DISPLAY} className="text-lg text-foreground mt-0.5">{VERIFICATION_STEPS[step]}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* Step 0 — Applicant Info */}
        {step === 0 && (
          <>
            {[
              { title: "Basic Profile", rows: [
                { label: "First Name", value: c.firstName }, { label: "Middle Name", value: c.middleName },
                { label: "Surname", value: c.surname }, { label: "Gender", value: c.gender },
                { label: "Date of Birth", value: c.dob }, { label: "PAN", value: c.panNumber, verified: c.panVerified },
                { label: "Mobile", value: c.mobile }, { label: "Alternate Mobile", value: c.alternateMobile },
                { label: "Personal Email", value: c.email }, { label: "Office Email", value: c.officialEmail },
                { label: "Screened By", value: c.screenedBy },
                { label: "Screened On", value: c.screenedOn === "N/A" ? "N/A" : new Date(c.screenedOn).toLocaleString("en-IN") },
              ]},
              { title: "KYC Details", rows: [
                { label: "PAN Number", value: c.panNumber, verified: c.panVerified },
                { label: "Aadhaar Number", value: c.aadhaarNumber, verified: c.aadhaarVerified },
              ]},
              { title: `Residence (${c.residenceType || "N/A"})`, rows: [
                { label: "Address Line 1", value: c.address }, { label: "Address Line 2", value: c.city },
                { label: "State", value: c.state }, { label: "Pincode", value: c.pinCode },
                { label: "Residence Type", value: c.residenceType },
              ]},
              { title: `Secondary Residence (${c.residenceType || "N/A"})`, rows: [
                { label: "Address Line 1", value: c.secondaryAddress }, { label: "Address Line 2", value: c.city },
                { label: "City", value: c.city }, { label: "State", value: c.state },
                { label: "Pincode", value: c.pinCode }, { label: "Residence Type", value: c.residenceType },
              ]},
              { title: "Employment", rows: [
                { label: "Employer Name", value: c.employer }, { label: "Employment Type", value: c.employmentType },
                { label: "Employer Type", value: c.employerType }, { label: "Designation", value: c.designation },
                { label: "Monthly Income", value: c.income === 0 ? "N/A" : `₹${c.income.toLocaleString("en-IN")}` },
                { label: "Official Email", value: c.officialEmail }, { label: "Work Address", value: c.workAddress },
                { label: "Work City", value: c.workCity }, { label: "Work State", value: c.workState },
                { label: "Work Pincode", value: c.workPinCode }, { label: "Employment Experience", value: c.employedSince },
              ]},
              { title: "Residence Verification", rows: Object.entries(c.residenceVerification || {}).filter(([key]) => key !== "photo").map(([key, value]) => ({ label: key.replace(/([A-Z])/g, " $1"), value: String(value || "N/A") })) },
              { title: "Office Verification", rows: Object.entries(c.officeVerification || {}).filter(([key]) => key !== "photo").map(([key, value]) => ({ label: key.replace(/([A-Z])/g, " $1"), value: String(value || "N/A") })) },
              { title: "Loan Details", rows: [
                { label: "Loan Type", value: LOAN_LABELS[c.loanType] }, { label: "Loan Amount", value: fmt(c.loanAmount) },
                { label: "Bank / Branch", value: c.bankBranch },
              ]},
            ].map(section => (
              <section key={section.title} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-secondary border-b border-border">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">{section.title}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {section.rows.map(row => (
                    <div key={`${section.title}-${row.label}`} className="px-4 py-3 border-b border-border sm:[&:nth-child(odd)]:border-r min-w-0">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{row.label}</p>
                      <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        <p className="text-sm text-foreground break-words min-w-0">{row.value || "N/A"}</p>
                        {'verified' in row && row.verified && <CheckCircle size={12} className="text-emerald-500 shrink-0" />}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <div className="bg-amber-400/8 border border-amber-400/20 rounded-xl p-3 flex gap-2.5">
              <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300 leading-relaxed">Confirm all details with physical KYC documents before proceeding.</p>
            </div>
          </>
        )}

        {/* Step 1 — Documents */}
        {step === 1 && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">Scan and verify all KYC documents. Ensure originals are present and match the applicant.</p>
            <DocScanItem title="Aadhaar Card" subtitle="12-digit UID · UIDAI issued" scanned={docs.aadhaar} onScan={image => captureAndStore(image, 'aadhaar', aadhaar => setDocs(d => ({ ...d, aadhaar })))} />
            <DocScanItem title="PAN Card" subtitle="10-character Income Tax ID" scanned={docs.pan} onScan={image => captureAndStore(image, 'pan', pan => setDocs(d => ({ ...d, pan })))} />
            {c.loanType === "home" && (
              <DocScanItem title="Property Title Deed" subtitle="Sale deed / registration copy" scanned={extraDocument} onScan={image => captureAndStore(image, 'extra_document', setExtraDocument)} />
            )}
            {c.loanType === "gold" && (
              <DocScanItem title="Gold Valuation Certificate" subtitle="Certified assayer report" scanned={extraDocument} onScan={image => captureAndStore(image, 'extra_document', setExtraDocument)} />
            )}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-foreground mb-2.5">Document Checklist</p>
              {["Photo matches applicant face", "Name matches application form", "Address matches records", "No visible tampering or damage", "Document within validity period"].map((item, index) => (
                <label key={item} className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  <input type="checkbox" checked={checklist[index]} onChange={e => setChecklist(current => current.map((value, i) => i === index ? e.target.checked : value))} className="accent-white rounded" />
                  {item}
                </label>
              ))}
            </div>
            {uploadError && <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3"><AlertCircle size={14} />{uploadError}</div>}
          </>
        )}

        {/* Step 2 — Photo Capture */}
        {step === 2 && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">Capture geo-tagged photographs as per RBI circular RBI/2024-25/67. Ensure good lighting.</p>
            <CameraCapture label="Applicant Photograph" value={photos.applicant} facingMode="user" onCapture={image => captureAndStore(image, 'applicant', applicant => setPhotos(p => ({ ...p, applicant })))} />
            <CameraCapture label="Residence / Office" value={photos.residenceOffice} facingMode="environment" onCapture={image => captureAndStore(image, 'residence_office', residenceOffice => setPhotos(p => ({ ...p, residenceOffice })))} />
            {uploadError && <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3"><AlertCircle size={14} />{uploadError}</div>}
          </>
        )}

        {/* Step 3 — GPS */}
        {step === 3 && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">Confirm your current GPS location matches the applicant's registered address.</p>
            <GPSMap lat={location?.latitude ?? c.gpsCoords[0]} lng={location?.longitude ?? c.gpsCoords[1]} />
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {[
                { label: "Registered Address", value: `${c.address}, ${c.city}` },
                { label: "Current Address", value: location?.address || "Tap Use Current Location" },
                { label: "GPS Coordinates", value: location ? `${location.latitude.toFixed(6)}°, ${location.longitude.toFixed(6)}°` : "Not captured" },
                { label: "Accuracy", value: location ? `±${Math.round(location.accuracy)} metres` : "N/A" },
                { label: "GPS Status", value: gpsOk ? (location?.source === "network" ? "Approximate network location" : "GPS location captured") : "Waiting" },
              ].map((row) => (
                <div key={row.label} className="px-4 py-3 flex justify-between items-center gap-4">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p style={MONO} className="text-xs text-foreground text-right">{row.value}</p>
                </div>
              ))}
            </div>
            <button
              onClick={useCurrentLocation}
              disabled={locating}
              className={`w-full py-3.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                gpsOk
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-secondary border border-border text-foreground hover:bg-accent"
              }`}
            >
              {locating ? <><RefreshCw size={16} className="animate-spin" /> Finding Address…</> : gpsOk ? <><CheckCircle size={16} /> Refresh Current Location</> : <><Crosshair size={16} /> Use Current Location</>}
            </button>
            {locationError && <div className={`flex items-center gap-2 text-xs rounded-xl p-3 ${gpsOk ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" : "text-rose-400 bg-rose-500/10 border border-rose-500/20"}`}><AlertCircle size={14} />{locationError}</div>}
          </>
        )}

        {/* Step 4 — Signature */}
        {step === 4 && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">Obtain the applicant's digital signature acknowledging the verification visit.</p>
            <SignaturePad onSigned={setSignature} />
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs font-medium text-foreground mb-2">Applicant Declaration</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                I, <strong className="text-foreground">{c.applicant}</strong>, confirm that I have been visited by an authorised GeetPay field verification agent from Waqt Finance and all information collected during this visit is accurate to the best of my knowledge. Date: {new Date().toLocaleDateString("en-IN")}.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Fingerprint size={14} />
              <span>Biometric consent (optional)</span>
            </div>
          </>
        )}

        {/* Step 5 — Submit */}
        {step === 5 && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed">Review verification summary and submit the final report.</p>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Verification Summary</p>
              {[
                { label: "Applicant Info", done: true },
                { label: "Documents Verified", done: Boolean(docs.aadhaar && docs.pan && checklist.every(Boolean) && (!['home', 'gold'].includes(c.loanType) || extraDocument)) },
                { label: "Photos Captured", done: Boolean(photos.applicant && photos.residenceOffice) },
                { label: "GPS Confirmed", done: gpsOk },
                { label: "Signature Obtained", done: Boolean(signature) },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-foreground">{item.label}</span>
                  {item.done ? <CheckCircle size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-rose-400" />}
                </div>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Verification Outcome</p>
              <div className="grid grid-cols-3 gap-2">
                {(["positive", "negative", "refer"] as const).map((opt) => (
                  <button key={opt} onClick={() => setOutcome(opt)}
                    className={`py-3 rounded-xl text-xs font-medium border capitalize transition-all ${
                      outcome === opt
                        ? opt === "positive" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : opt === "negative" ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                          : "bg-violet-500/20 text-violet-400 border-violet-500/40"
                        : "bg-card text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {opt === "refer" ? "Refer" : opt === "positive" ? "Positive" : "Negative"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Remarks</p>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Add field observations, discrepancies, or notes…"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
              />
              {!remarks.trim() && <p className="text-[10px] text-amber-400 mt-1">Remarks are required before submission.</p>}
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      {submitError && <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3"><AlertCircle size={14} className="shrink-0" /><span>{submitError}</span></div>}
      <div className="px-4 py-3 border-t border-border bg-card flex gap-2.5 shrink-0">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        {step < VERIFICATION_STEPS.length - 1 ? (
          <button onClick={goToNextStep} disabled={!canProceed}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-35"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={submit} disabled={!canProceed || submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-35"
          >
            {submitting ? <><RefreshCw size={15} className="animate-spin" /> Submitting…</> : <><Send size={15} /> Submit Report</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardScreen({ cases, user, onSelectCase }: { cases: VerificationCase[]; user: FieldUser; onSelectCase: (c: VerificationCase) => void }) {
  const pending = cases.filter(c => c.status === "new" || c.status === "pending" || c.status === "in-progress");
  const done = cases.filter(c => ["completed", "rejected", "referred"].includes(c.status));
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Banner */}
      <div className="dashboard-hero border-b border-border px-5 md:px-7 pt-6 pb-7 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-[0.06]"><MandalaSVG size={150} opacity={1} /></div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{today}</p>
        <h2 style={DISPLAY} className="text-[22px] text-foreground mt-1">नमस्ते, {user.name}</h2>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <p className="text-[10px] text-muted-foreground">Active · {user.role} · {user.employeeId}</p>
        </div>
      </div>

      <div className="dashboard-content px-4 pt-4 pb-6 space-y-5 md:space-y-0">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: cases.length, label: "Assigned" },
            { n: done.length, label: "Completed" },
            { n: pending.length, label: "Pending" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-3 text-center">
              <p style={DISPLAY} className="text-[28px] leading-none text-foreground">{s.n}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex justify-between mb-2">
            <p className="text-xs font-medium text-foreground">Daily Target</p>
            <p style={MONO} className="text-xs text-muted-foreground">{done.length}/{cases.length} cases</p>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${cases.length ? (done.length / cases.length) * 100 : 0}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {cases.length ? Math.round((done.length / cases.length) * 100) : 0}% complete · {pending.length} case{pending.length !== 1 ? "s" : ""} remaining
          </p>
        </div>

        {/* RBI Notice */}
        <div className="bg-secondary border border-border rounded-2xl p-4 flex gap-3">
          <AlertCircle size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">NBFC Partner: Waqt Finance Pvt Ltd - RBI LICENCE NO.: B.10.00143</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Mandatory geo-tagged photographs for home loans above ₹25 Lakh. Updated biometric consent form applicable from 01 Aug 2024.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cases List ───────────────────────────────────────────────────────────────

function CasesScreen({ cases, loading, error, onRetry, onSelectCase }: { cases: VerificationCase[]; loading: boolean; error: string; onRetry: () => void; onSelectCase: (c: VerificationCase) => void }) {
  const [filter, setFilter] = useState<"new" | "pending" | "completed" | "rejected">("new");
  const [search, setSearch] = useState("");
  const newCasesCount = cases.filter(c => c.status === "new").length;

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchesStatus = c.status === filter;
    return matchesStatus &&
      (!search || c.applicant.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-card border-b border-border px-4 pt-4 pb-3 space-y-3">
        <div>
          <h2 style={DISPLAY} className="text-xl text-foreground">Cases</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">{newCasesCount} new cases · {new Date().toLocaleDateString("en-IN")}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, city…"
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
      </div>
      <div className="flex gap-1.5 px-4 py-3 border-b border-border overflow-x-auto">
        {[
          { key: "new", label: "New" },
          { key: "pending", label: "Pending" },
          { key: "completed", label: "Verified" },
          { key: "rejected", label: "Rejected" },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-colors ${
              filter === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground"><RefreshCw size={24} className="animate-spin" /><p className="text-sm">Loading assigned cases…</p></div>
        ) : error ? (
          <div className="py-16 flex flex-col items-center gap-3 text-rose-400 text-center"><AlertCircle size={28} /><p className="text-sm">{error}</p><button onClick={onRetry} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs">Retry</button></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <FileText size={32} className="opacity-25" />
            <p className="text-sm">No matching cases</p>
          </div>
        ) : filtered.map(c => {
          const isClosed = ["completed", "rejected", "referred"].includes(c.status);
          return (
          <button key={c.id} onClick={() => { if (!isClosed) onSelectCase(c); }} disabled={isClosed}
            className={`w-full text-left bg-card border border-border rounded-xl p-4 transition-colors ${isClosed ? "cursor-not-allowed opacity-75" : "hover:bg-accent active:scale-[0.99]"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-foreground leading-tight">{c.applicant}</p>
              <StatusBadge status={c.status} />
            </div>
            <p style={MONO} className="text-[10px] text-muted-foreground mt-0.5">{c.id}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
              <MapPin size={10} className="inline mr-1 opacity-60" />{c.address}, {c.city} – {c.pinCode}
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted-foreground">{LOAN_LABELS[c.loanType]}</span>
              <span style={MONO} className="text-xs text-foreground">{fmt(c.loanAmount)}</span>
            </div>
            {isClosed && <p className="text-[9px] text-emerald-400 mt-2">Verification submitted · Re-opening disabled</p>}
          </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────

function HistoryScreen({ history, loading, error, onRetry }: { history: HistoryData; loading: boolean; error: string; onRetry: () => void }) {
  const { summary } = history;
  const percent = (value: number) => summary.total ? `${(value / summary.total) * 100}%` : "0%";
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4">
        <h2 style={DISPLAY} className="text-xl text-foreground">History</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Verification activity · Last 7 days</p>
      </div>
      <div className="px-4 py-4 space-y-4">
        {/* Weekly summary */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-3">This Week</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[{ n: summary.total, l: "Total" }, { n: summary.positive, l: "Positive" }, { n: summary.negative, l: "Negative" }, { n: summary.referred, l: "Referred" }].map(s => (
              <div key={s.l}>
                <p style={DISPLAY} className="text-[26px] leading-none text-foreground">{s.n}</p>
                <p className="text-[9px] text-muted-foreground mt-1.5 uppercase tracking-wide">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-1 bg-secondary rounded-full overflow-hidden flex">
            <div className="bg-foreground" style={{ width: percent(summary.positive) }} />
            <div className="bg-foreground/25 mx-0.5" style={{ width: percent(summary.negative) }} />
            <div className="bg-foreground/10" style={{ width: percent(summary.referred) }} />
          </div>
          <div className="flex items-center gap-4 mt-2.5">
            {[["bg-foreground", "Positive"], ["bg-foreground/25", "Negative"], ["bg-foreground/10", "Referred"]].map(([bg, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${bg}`} />
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {loading ? <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground"><RefreshCw size={24} className="animate-spin" /><p className="text-sm">Loading history…</p></div>
        : error ? <div className="py-12 flex flex-col items-center gap-3 text-rose-400 text-center"><AlertCircle size={28} /><p className="text-sm">{error}</p><button onClick={onRetry} className="px-4 py-2 rounded-xl bg-foreground text-background text-xs">Retry</button></div>
        : history.items.length === 0 ? <div className="py-16 flex flex-col items-center gap-3 text-muted-foreground"><FileText size={32} className="opacity-25" /><p className="text-sm">No submitted reports yet</p></div>
        : (
          <div>
            <Divider />
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest my-2">Submitted Field Reports</p>
            <div className="space-y-1.5">
              {history.items.map(item => (
                <div key={item.reportId} className="bg-card border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground font-medium truncate">{item.applicant}</p>
                    <p style={MONO} className="text-[10px] text-muted-foreground mt-0.5">{item.caseId} · {item.reportId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={MONO} className="text-xs text-muted-foreground">{fmt(item.loanAmount)}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(item.submittedAt).toLocaleString("en-IN")} · {item.agent}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileScreen({ user, installPrompt, installPreparing, onInstall, onLogout }: { user: FieldUser; installPrompt: BeforeInstallPromptEvent | null; installPreparing: boolean; onInstall: () => Promise<void>; onLogout: () => void }) {
  const languages = ["English", "हिन्दी", "বাংলা", "తెలుగు", "मराठी", "தமிழ்", "ગુજરાતી", "ಕನ್ನಡ", "മലയാളം", "ਪੰਜਾਬੀ", "ଓଡ଼ିଆ", "অসমীয়া"];
  const [language, setLanguage] = useState(() => localStorage.getItem("field_language") || "English");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [gpsOpen, setGpsOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy: number; address: string; source: string } | null>(null);
  const isInstalled = window.matchMedia("(display-mode: standalone)").matches;

  function chooseLanguage(value: string) {
    setLanguage(value);
    localStorage.setItem("field_language", value);
    setLanguageOpen(false);
  }

  async function showCurrentLocation() {
    setGpsOpen(true); setGpsLoading(true); setGpsError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 })
      );
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const response = await fetch(`/api/field/auth/reverse-geocode?lat=${latitude}&lng=${longitude}`, { credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Address unavailable");
      setCurrentLocation({ latitude, longitude, accuracy: position.coords.accuracy, address: result.data.address, source: "GPS" });
    } catch {
      try {
        const response = await fetch("/api/field/auth/network-location", { credentials: "include" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Location unavailable");
        setCurrentLocation({ ...result.data, source: "Network (approximate)" });
      } catch (error) {
        setGpsError(error instanceof Error ? error.message : "Unable to get current location");
      }
    } finally { setGpsLoading(false); }
  }

  return (
    <div className="profile-screen flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full">
      <div className="profile-header bg-card border-b border-border px-4 pt-5 pb-5 relative overflow-hidden min-w-0">
        <div className="absolute -right-6 -top-6 opacity-[0.06]"><MandalaSVG size={130} opacity={1} /></div>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(240,240,240,0.08)]">
            <span style={DISPLAY} className="text-background text-xl">{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 style={DISPLAY} className="text-lg text-foreground leading-tight truncate">{user.name}</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{user.role}</p>
            <p style={MONO} className="text-[10px] text-muted-foreground truncate">{user.employeeId}</p>
          </div>
        </div>
      </div>

      <div className="profile-content px-4 py-4 space-y-4 min-w-0 w-full">
        <div className="profile-settings bg-card border border-border rounded-2xl divide-y divide-border min-w-0 overflow-hidden">
          {[
            { icon: <Globe size={14} />, label: "Language", value: language, action: () => setLanguageOpen(true) },
            { icon: <Bell size={14} />, label: "Notifications", value: "Enabled" },
            { icon: <Navigation size={14} />, label: "GPS Mode", value: currentLocation ? currentLocation.source : "Current Location", action: showCurrentLocation },
            { icon: <Download size={14} />, label: "Install App", value: isInstalled ? "Installed" : installPrompt ? "Install" : installPreparing ? "Preparing…" : "Not available", action: onInstall },
          ].map(row => (
            <button key={row.label} type="button" onClick={row.action} disabled={!row.action} className="w-full min-w-0 px-4 py-3 flex items-center justify-between gap-3 text-left disabled:cursor-default enabled:hover:bg-accent transition-colors overflow-hidden">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-muted-foreground">{row.icon}</span>
                <span className="text-sm text-foreground truncate">{row.label}</span>
              </div>
              <div className="flex items-center justify-end gap-2 min-w-0 max-w-[48%] shrink">
                <span className="text-xs text-muted-foreground truncate">{row.value}</span>
                <ChevronRight size={13} className="text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        <button onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 border border-border rounded-2xl py-3.5 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>

        <p className="text-center text-[9px] text-muted-foreground pb-2 leading-relaxed">
          GeetPay · v3.2.1 · Waqt Finance<br />
          © 2026 Waqt Finance. All rights reserved.
        </p>
      </div>
      {languageOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center" onClick={() => setLanguageOpen(false)}>
        <div className="bg-card border border-border rounded-t-3xl w-full max-w-sm max-h-[75vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h3 style={DISPLAY} className="text-xl">Choose Language</h3><button onClick={() => setLanguageOpen(false)} className="text-2xl text-muted-foreground">×</button></div>
          <div className="grid grid-cols-2 gap-2">{languages.map(item => <button key={item} onClick={() => chooseLanguage(item)} className={`p-3 rounded-xl border text-sm text-left ${language === item ? "bg-foreground text-background border-foreground" : "bg-secondary border-border text-foreground"}`}>{item}</button>)}</div>
        </div>
      </div>}
      {gpsOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-end justify-center" onClick={() => setGpsOpen(false)}>
        <div className="bg-card border border-border rounded-t-3xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h3 style={DISPLAY} className="text-xl">Current Location</h3><button onClick={() => setGpsOpen(false)} className="text-2xl text-muted-foreground">×</button></div>
          {gpsLoading ? <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground"><RefreshCw className="animate-spin" /><p className="text-sm">Finding current location…</p></div>
          : gpsError ? <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">{gpsError}</div>
          : currentLocation && <div className="space-y-3"><GPSMap lat={currentLocation.latitude} lng={currentLocation.longitude} /><div className="bg-secondary border border-border rounded-xl divide-y divide-border">{[
            { label: "Address", value: currentLocation.address }, { label: "Coordinates", value: `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` }, { label: "Accuracy", value: `±${Math.round(currentLocation.accuracy)} metres` }, { label: "Source", value: currentLocation.source },
          ].map(row => <div key={row.label} className="p-3 flex justify-between gap-4 text-xs"><span className="text-muted-foreground">{row.label}</span><span className="text-foreground text-right">{row.value}</span></div>)}</div><button onClick={showCurrentLocation} className="w-full py-3 rounded-xl bg-foreground text-background text-sm">Refresh Location</button></div>}
        </div>
      </div>}
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: FieldUser) => void }) {
  const [empId, setEmpId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!/^FV-\d{4}-\d{4}$/i.test(empId.trim())) { setError("Enter a valid Employee ID (FV-YYYY-XXXX)."); return; }
    if (pin.length < 4) { setError("Please enter your 4-digit PIN."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/field/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ employeeId: empId.trim().toUpperCase(), pin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Login failed. Please try again.");
      onLogin(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute -top-16 -left-16 opacity-[0.06]"><MandalaSVG size={220} opacity={1} /></div>
      <div className="absolute -bottom-16 -right-16 opacity-[0.06]"><MandalaSVG size={220} opacity={1} /></div>
      <div className="w-full max-w-xs">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5"><GeetPayLogo /></div>
          <p className="text-[9px] text-muted-foreground mt-1.5 tracking-[0.22em] uppercase">Field Verification System</p>
          <div className="flex items-center justify-center gap-2.5 mt-2.5">
            <div className="h-px w-10 bg-border" />
            <span className="text-[9px] text-muted-foreground">Waqt Finance</span>
            <div className="h-px w-10 bg-border" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-2">Employee ID</label>
            <input value={empId} onChange={e => setEmpId(e.target.value)}
              style={MONO}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              placeholder="FV-YYYY-XXXX"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-2">4-Digit PIN</label>
            <div className="relative">
              <input type={showPin ? "text" : "password"} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4} onKeyDown={e => e.key === "Enter" && submit()}
                style={MONO}
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground pr-12 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                placeholder="••••"
              />
              <button onClick={() => setShowPin(!showPin)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl px-3 py-2">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </div>
          )}
          <button onClick={submit} disabled={loading}
            className="w-full bg-foreground text-background py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-60"
          >
            {loading ? <><RefreshCw size={15} className="animate-spin" /> Authenticating…</> : <><Shield size={15} /> Secure Login</>}
          </button>
        </div>

        <p className="text-center text-[9px] text-muted-foreground mt-6 leading-relaxed">
          Authorised Personnel Only · All access is logged<br />
          <span className="opacity-40">Contact your administrator if you need access</span>
        </p>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({ user, cases, onViewCases }: { user: FieldUser; cases: VerificationCase[]; onViewCases: () => void }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const newCases = cases.filter(item => item.status === "new");
  return (
    <div className="geetpay-topbar bg-card border-b border-border px-4 py-2.5 flex items-center justify-between shrink-0 relative z-40">
      <div className="flex items-center gap-2.5">
        <GeetPayLogo />
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setNotificationsOpen(value => !value)} className="relative p-2 text-slate-600 hover:text-slate-950 transition-colors" aria-label={`${newCases.length} new case notifications`}>
          <Bell size={18} />
          {newCases.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{newCases.length > 9 ? "9+" : newCases.length}</span>}
        </button>
        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
          <span className="text-[9px] font-semibold text-slate-600">{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>
        </div>
      </div>
      {notificationsOpen && <div className="absolute right-3 top-[calc(100%+8px)] w-[min(340px,calc(100vw-24px))] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center"><div><p className="font-semibold text-sm">Notifications</p><p className="text-[10px] text-slate-500">New assigned cases</p></div><span className="text-[10px] font-semibold text-orange-600">{newCases.length} new</span></div>
        <div className="max-h-72 overflow-y-auto">{newCases.length === 0 ? <p className="px-4 py-8 text-center text-xs text-slate-500">No new case notification</p> : newCases.slice(0, 5).map(item => <button key={item.applicationId || item.id} type="button" onClick={() => { setNotificationsOpen(false); onViewCases(); }} className="w-full px-4 py-3 text-left border-b border-slate-100 hover:bg-orange-50"><p className="text-xs font-semibold">New case assigned: {item.applicant}</p><p className="text-[10px] text-slate-500 mt-1">{item.id} · {item.city} · {LOAN_LABELS[item.loanType]}</p></button>)}</div>
        {newCases.length > 0 && <button type="button" onClick={() => { setNotificationsOpen(false); onViewCases(); }} className="w-full py-3 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600">View all new cases</button>}
      </div>}
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Home", icon: <Home size={20} /> },
    { key: "cases", label: "Cases", icon: <ClipboardList size={20} /> },
    { key: "history", label: "History", icon: <Clock size={20} /> },
    { key: "profile", label: "Profile", icon: <User size={20} /> },
  ];

  return (
    <div className="bg-card border-t border-border px-2 py-1.5 flex shrink-0">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
            active === t.key ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.icon}
          <span className="text-[8px] uppercase tracking-widest">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<FieldUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [activeCase, setActiveCase] = useState<VerificationCase | null>(null);
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState("");
  const [history, setHistory] = useState<HistoryData>({ summary: { total: 0, positive: 0, negative: 0, referred: 0 }, items: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPreparing, setInstallPreparing] = useState(true);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallPreparing(false);
    };
    const installed = () => { setInstallPrompt(null); setInstallPreparing(false); };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", installed);
    navigator.serviceWorker?.ready.then(() => window.setTimeout(() => setInstallPreparing(false), 1500));
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function installApp() {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  useEffect(() => {
    fetch("/api/field/auth/me", { credentials: "include" })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.data) throw new Error("No active session");
        setUser(result.data);
        setLoggedIn(true);
      })
      .catch(() => { setUser(null); setLoggedIn(false); })
      .finally(() => setCheckingSession(false));
  }, []);

  async function loadCases() {
    setCasesLoading(true);
    setCasesError("");
    try {
      const response = await fetch("/api/field/auth/cases", { credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setUser(null);
        setLoggedIn(false);
        throw new Error("Your session expired. Please login again.");
      }
      if (!response.ok) throw new Error(result.message || "Unable to load assigned cases.");
      setCases(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setCasesError(err instanceof Error ? err.message : "Unable to connect to the server.");
    } finally {
      setCasesLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("/api/field/auth/history", { credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Unable to load verification history.");
      setHistory(result.data);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Unable to connect to the server.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (!loggedIn) return;
    loadCases();
    loadHistory();
    const notificationPoll = window.setInterval(loadCases, 30000);
    return () => window.clearInterval(notificationPoll);
  }, [loggedIn]);

  async function logout() {
    try {
      await fetch("/api/field/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      setLoggedIn(false);
      setCases([]);
      setHistory({ summary: { total: 0, positive: 0, negative: 0, referred: 0 }, items: [] });
      setActiveCase(null);
      setTab("dashboard");
    }
  }

  async function openCase(c: VerificationCase) {
    if (["completed", "rejected", "referred"].includes(c.status)) return;
    setActiveCase(c);
  }

  if (checkingSession) return <div className="min-h-screen bg-background flex items-center justify-center"><RefreshCw className="animate-spin text-muted-foreground" /></div>;
  if (!loggedIn || !user) return <LoginScreen onLogin={authenticatedUser => { setUser(authenticatedUser); setLoggedIn(true); }} />;

  if (activeCase) {
    return (
      <div className="app-shell flex justify-center">
        <div className="app-panel flex-1 flex flex-col max-w-md w-full">
          <CaseDetailScreen c={activeCase} user={user} onBack={() => { setActiveCase(null); loadCases(); }} onSubmitted={() => { loadCases(); loadHistory(); }} onProgress={updated => {
            setActiveCase(updated);
            setCases(current => current.map(item => item.applicationId === updated.applicationId ? updated : item));
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex justify-center">
      <div className="app-panel mobile-app-panel flex-1 flex flex-col w-full">
        <TopBar user={user} cases={cases} onViewCases={() => setTab("cases")} />
        {tab === "dashboard" && <DashboardScreen cases={cases} user={user} onSelectCase={openCase} />}
        {tab === "cases" && <CasesScreen cases={cases} loading={casesLoading} error={casesError} onRetry={loadCases} onSelectCase={openCase} />}
        {tab === "history" && <HistoryScreen history={history} loading={historyLoading} error={historyError} onRetry={loadHistory} />}
        {tab === "profile" && <ProfileScreen user={user} installPrompt={installPrompt} installPreparing={installPreparing} onInstall={installApp} onLogout={logout} />}
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  );
}
