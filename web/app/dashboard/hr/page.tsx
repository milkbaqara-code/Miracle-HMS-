// web/app/dashboard/hr/page.tsx
'use client';
import ViewModeBanner, { useViewMode } from '../../components/ViewModeBanner';
import { useCurrencyLang } from '../../components/CurrencyLangContext';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import DeptAlignmentMatrix from '../../components/DeptAlignmentMatrix';
import { DEPT_TAXONOMY } from '../../components/DeptAlignmentMatrix';
import { useToast } from '../../components/SovereignToast';
import { useConfirm } from '../../components/SovereignConfirm';


// ==========================================
// TYPE DEFINITION: THE SOVEREIGN OPERATIVE
// ==========================================
interface Operative {
  id: string;
  name: string;
  lastName: string;
  pos: string;
  sal: number;
  commRate: number;
  revImpact: number;
  status: 'ON-DUTY' | 'OFFLINE' | 'TERMINATED';
  is_online?: boolean;
  last_seen?: string;
  img: string | null;
  roi_score?: string;
  username?: string;
  password?: string;
  dept?: string;
  dept_alignments?: string[];
  executive_tier?: string;
  industry_verticals?: string[];
  role?: string;
  efficiency?: number;
  gender?: 'MALE' | 'FEMALE' | 'UNSPECIFIED';
  joined?: string;
  hours_month?: number;
  commission?: number;
  total_monthly?: number;
}

// STE Types
interface DeptScanResult {
  department: string; zone: string; headcount: number; open_tickets: number;
  workload_per_person: number; avg_efficiency_pct: number; avg_salary_aed: number;
  salary_range_aed: { min: number; max: number };
  urgency_score: number; urgency_level: string; needs_hiring: boolean; trigger_reasons: string[];
}
interface JobVacancy {
  id: string; title: string; department: string; executive_tier: string; zone: string;
  positions_count: number; location: string; role_summary: string;
  responsibilities: {order:number;text:string}[];
  requirements_mandatory: {type:string;text:string}[];
  requirements_preferred: {type:string;text:string}[];
  competencies: string[]; working_conditions: string;
  salary_min: number; salary_max: number; currency: string;
  benefits: {title:string;detail:string}[];
  linkedin_url: string; indeed_url: string;
  status: string; is_featured: boolean; closing_date: string;
  ai_generated: boolean; ai_urgency_score: number; ai_trigger_reason: string;
  gm_notes: string; approved_by: string; published_at: string;
  created_by: string; created_at: string; applications_count: number;
}
interface JobApplication {
  id: string; vacancy_id: string; vacancy_title: string; vacancy_department: string;
  applicant_name: string; applicant_email: string; applicant_phone: string;
  applicant_nationality: string; current_location: string; notice_period: string;
  current_salary: string; expected_salary: string; cover_letter: string;
  cv_url: string; linkedin_profile: string; source: string; status: string;
  hr_notes: string; applied_at: string; onboarding_prefill: any;
}

export default function HumanResourcesHub() {
  const { formatMoney, t, currency } = useCurrencyLang();
  const isViewMode = useViewMode();
  const { showToast } = useToast();
  const { showConfirm } = useConfirm();
  
  const [activeTab, setActiveTab] = useState<'GALLERY' | 'PERFORMANCE' | 'ONBOARDING' | 'REGISTRY' | 'PAYROLL' | 'DOCUMENTS' | 'MY_SOP' | 'TALENT_ENGINE' | 'COMPLIANCE' | 'LEAVE' | 'TRAINING' | 'WORKFORCE_INTEL'>('GALLERY');
  const [selectedGalleryCategory, setSelectedGalleryCategory] = useState<string>('ALL');
  const [selectedStaff, setSelectedStaff] = useState<Operative | null>(null);
  const [isKernelSyncing, setIsKernelSyncing] = useState<boolean>(true);
  const [departmentSops, setDepartmentSops] = useState<Record<string, string[]>>({});
  const [staffRegistry, setStaffRegistry] = useState<Operative[]>([]);

  // COMPLIANCE State
  const [complianceAlerts, setComplianceAlerts] = useState<any[]>([]);
  const [selectedEmpDocs, setSelectedEmpDocs] = useState<any[]>([]);
  const [gratuityCalc, setGratuityCalc] = useState<any>(null);
  const [isCompLoading, setIsCompLoading] = useState(false);
  const [selectedCompEmployeeId, setSelectedCompEmployeeId] = useState<string>('');
  const [compFormData, setCompFormData] = useState({
    doc_type: 'VISA',
    doc_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: 'Dubai GDRFA',
    notes: ''
  });

  // LEAVE State
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [isLeaveLoading, setIsLeaveLoading] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    employee_id: '',
    leave_type: 'ANNUAL',
    start_date: '',
    end_date: '',
    reason: '',
    cover_plan: ''
  });

  // TRAINING State
  const [trainingPrograms, setTrainingPrograms] = useState<any[]>([]);
  const [trainingAlerts, setTrainingAlerts] = useState<any[]>([]);
  const [isTrainingLoading, setIsTrainingLoading] = useState(false);
  const [trainingFormData, setTrainingFormData] = useState({
    name: '',
    category: 'HACCP',
    description: '',
    expiry_months: 12,
    is_mandatory: false,
    applicable_depts: [] as string[]
  });
  const [selectedProgForEnroll, setSelectedProgForEnroll] = useState<number | ''>('');
  const [selectedStaffForEnroll, setSelectedStaffForEnroll] = useState<string[]>([]);

  // STE State
  const [steTab, setSteTab] = useState<'RADAR' | 'VACANCIES' | 'GM_QUEUE' | 'APPLICANTS'>('RADAR');
  const [scanResults, setScanResults] = useState<DeptScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [steStats, setSteStats] = useState<any>({});
  const [selectedVacancy, setSelectedVacancy] = useState<JobVacancy | null>(null);
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [jdDraft, setJdDraft] = useState<any>(null);
  const [showJDEditor, setShowJDEditor] = useState(false);
  const [selectedDeptForVacancy, setSelectedDeptForVacancy] = useState<DeptScanResult | null>(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [isSavingVacancy, setIsSavingVacancy] = useState(false);
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const urgencyColor = (level: string) => level === 'CRITICAL' ? '#FF3131' : level === 'HIGH' ? '#FF8C00' : level === 'MODERATE' ? '#D4AF37' : '#39FF14';

  const fetchSTEData = async () => {
    try {
      const [vRes, aRes, sRes] = await Promise.all([
        fetch(`${API}/hr/talent/vacancies`),
        fetch(`${API}/hr/talent/applications`),
        fetch(`${API}/hr/talent/stats`),
      ]);
      if (vRes.ok) { const d = await vRes.json(); setVacancies(d.vacancies || []); }
      if (aRes.ok) { const d = await aRes.json(); setApplications(d.applications || []); }
      if (sRes.ok) { const d = await sRes.json(); setSteStats(d); }
    } catch(e) { console.error('STE fetch error', e); }
  };

  const runAGIScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`${API}/hr/talent/scan`);
      if (res.ok) { const d = await res.json(); setScanResults(d.results || []); showToast('AGI SCAN COMPLETE — ' + (d.departments_needing_hiring || 0) + ' departments flagged', 'success'); }
      else showToast('Scan failed', 'error');
    } catch(e) { showToast('Scan error', 'error'); }
    setIsScanning(false);
  };

  const generateJD = async (dept: DeptScanResult, title: string) => {
    setIsGeneratingJD(true);
    try {
      const res = await fetch(`${API}/hr/talent/generate-jd`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          department: dept.department, role_title: title,
          executive_tier: 'OPERATIVE', trigger_reason: dept.trigger_reasons.join('; '),
          ai_urgency_score: dept.urgency_score,
          salary_range_aed: dept.salary_range_aed, positions_count: 1,
        }),
      });
      const d = await res.json();
      if (d.status === 'OK') { setJdDraft(d.jd); setShowJDEditor(true); showToast('JD generated by AGI', 'success'); }
      else showToast(d.message || 'JD generation failed', 'error');
    } catch(e) { showToast('LLM error', 'error'); }
    setIsGeneratingJD(false);
  };

  const saveVacancy = async () => {
    if (!jdDraft) return;
    setIsSavingVacancy(true);
    try {
      const res = await fetch(`${API}/hr/talent/vacancies`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ...jdDraft, created_by: 'HR', ai_trigger_data: selectedDeptForVacancy || {} }),
      });
      const d = await res.json();
      if (d.status === 'CREATED') { showToast('Vacancy saved as DRAFT — ' + d.id, 'success'); setShowJDEditor(false); setJdDraft(null); fetchSTEData(); }
      else showToast('Save failed', 'error');
    } catch(e) { showToast('Save error', 'error'); }
    setIsSavingVacancy(false);
  };

  const submitForApproval = async (vacancyId: string) => {
    const res = await fetch(`${API}/hr/talent/vacancies/${vacancyId}/submit-for-approval`, { method: 'POST' });
    if (res.ok) { showToast('Sent to GM Approval Queue', 'success'); fetchSTEData(); }
    else showToast('Submit failed', 'error');
  };

  const gmAction = async (vacancyId: string, action: string, notes = '') => {
    const res = await fetch(`${API}/hr/talent/vacancies/${vacancyId}/gm-action`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action, notes, gm_username: 'GM' }),
    });
    if (res.ok) { showToast(`Vacancy ${action}D`, 'success'); fetchSTEData(); }
    else showToast('Action failed', 'error');
  };

  const updateAppStatus = async (appId: string, status: string) => {
    const res = await fetch(`${API}/hr/talent/applications/${appId}/status`, {
      method: 'PUT', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ status }),
    });
    if (res.ok) { showToast('Status updated', 'success'); fetchSTEData(); setSelectedApp(null); }
    else showToast('Update failed', 'error');
  };

  const moveToOnboarding = (app: JobApplication) => {
    if (app.onboarding_prefill) {
      localStorage.setItem('ste_onboard_prefill', JSON.stringify(app.onboarding_prefill));
    }
    setActiveTab('ONBOARDING');
    showToast('Applicant data pre-filled in Onboarding tab', 'success');
  };

  useEffect(() => { if (activeTab === 'TALENT_ENGINE') fetchSTEData(); }, [activeTab]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/policy/current-lock`)
      .then(res => res.json())
      .then(data => {
        if (data.sops) setDepartmentSops(data.sops);
      })
      .catch(() => console.log('Policy DB offline'));
  }, []);

  const fetchSovereignRegistry = useCallback(async () => {
    setIsKernelSyncing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/performance-matrix?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'SUCCESS' && Array.isArray(data.analytics)) {
          // Map backend format back to frontend Operative interface
          const physicalStaff: Operative[] = data.analytics.map((emp: any) => ({
            id: emp.id,
            name: emp.name.split(' ')[0] || '',
            lastName: emp.name.split(' ').slice(1).join(' ') || '',
            pos: emp.position,
            sal: emp.salary,
            commRate: emp.commission_rate || 0,
            revImpact: emp.revenue,
            status: emp.status as any,
            is_online: emp.is_online,
            last_seen: emp.last_seen,
            img: (emp.img === '👤' || emp.img === '') ? null : emp.img,
            dept: emp.department,
            dept_alignments: emp.dept_alignments || [],
            executive_tier: emp.executive_tier || 'OPERATIVE',
            industry_verticals: emp.industry_verticals || [],
            role: emp.role || 'STAFF',
            joined: emp.joined,
            hours_month: emp.working_hours,
            commission: emp.commission,
            total_monthly: emp.total_monthly,
            efficiency: parseFloat((emp.efficiency || '0%').replace('%', '')),
            roi_score: emp.roi_score,
            username: emp.username,
            password: emp.password,
            gender: (emp.gender || 'UNSPECIFIED') as 'MALE' | 'FEMALE' | 'UNSPECIFIED'
          }));
          
          setStaffRegistry(physicalStaff);
          localStorage.setItem('miracle_hr_vault', JSON.stringify(physicalStaff));
        }
      }
    } catch (error) {
      console.error("Kernel Offline: Falling back to local HR vault.");
      const vault = localStorage.getItem('miracle_hr_vault');
      if (vault) {
        setStaffRegistry(JSON.parse(vault));
      } else {
        setStaffRegistry([]); // 🛡️ CDO FIX: NO GHOST DATA. If DB is empty, UI is empty.
      }
    } finally {
      setIsKernelSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchSovereignRegistry();
  }, [fetchSovereignRegistry]);

  const fetchComplianceData = async () => {
    setIsCompLoading(true);
    try {
      const res = await fetch(`${API}/hr/compliance/alerts`);
      if (res.ok) {
        const d = await res.json();
        setComplianceAlerts(d.alerts || []);
      }
    } catch (e) {
      console.error('Failed to fetch compliance alerts', e);
    } finally {
      setIsCompLoading(false);
    }
  };

  const fetchSelectedEmployeeDocs = async (empId: string) => {
    try {
      const res = await fetch(`${API}/hr/compliance/documents/${empId}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedEmpDocs(d.documents || []);
      }
    } catch (e) {
      console.error('Failed to fetch employee documents', e);
    }
  };

  const calculateGratuity = async (empId: string) => {
    try {
      const res = await fetch(`${API}/hr/compliance/gratuity/${empId}`);
      if (res.ok) {
        const d = await res.json();
        setGratuityCalc(d);
      }
    } catch (e) {
      console.error('Failed to calculate gratuity', e);
    }
  };

  const registerDocument = async (empId: string) => {
    try {
      const res = await fetch(`${API}/hr/compliance/documents/${empId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compFormData)
      });
      if (res.ok) {
        showToast('Document Registered', 'success', 'Compliance document stored.');
        fetchSelectedEmployeeDocs(empId);
        fetchComplianceData();
        setCompFormData({
          doc_type: 'VISA',
          doc_number: '',
          issue_date: '',
          expiry_date: '',
          issuing_authority: 'Dubai GDRFA',
          notes: ''
        });
      } else {
        showToast('Registration Failed', 'error', 'Invalid document parameters.');
      }
    } catch (e) {
      showToast('System Error', 'error', 'Kernel compliance service offline.');
    }
  };

  const fetchLeaveData = async () => {
    setIsLeaveLoading(true);
    try {
      const [reqsRes, balsRes] = await Promise.all([
        fetch(`${API}/hr/leave/all`),
        fetch(`${API}/hr/leave/balances`)
      ]);
      if (reqsRes.ok) {
        const d = await reqsRes.json();
        setLeaveRequests(d.requests || []);
      }
      if (balsRes.ok) {
        const d = await balsRes.json();
        setLeaveBalances(d.balances || []);
      }
    } catch (e) {
      console.error('Failed to fetch leave data', e);
    } finally {
      setIsLeaveLoading(false);
    }
  };

  const submitLeaveRequest = async () => {
    if (!leaveFormData.employee_id || !leaveFormData.start_date || !leaveFormData.end_date) {
      showToast('Error', 'error', 'Employee, start, and end dates are required.');
      return;
    }
    try {
      const res = await fetch(`${API}/hr/leave/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveFormData)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Request Submitted', 'success', 'Leave request recorded. Synapse notification dispatched.');
        fetchLeaveData();
        setLeaveFormData({
          employee_id: '',
          leave_type: 'ANNUAL',
          start_date: '',
          end_date: '',
          reason: '',
          cover_plan: ''
        });
      } else {
        showToast('Request Rejected', 'error', data.detail || 'Insufficient leave balance.');
      }
    } catch (e) {
      showToast('System Error', 'error', 'Kernel leave service offline.');
    }
  };

  const handleLeaveAction = async (leaveId: number, action: 'approve' | 'reject', rejectReason = '') => {
    try {
      const operatorId = localStorage.getItem('operative_id') || 'HR-ADMIN';
      const url = `${API}/hr/leave/${action}/${leaveId}`;
      const body = action === 'approve' 
        ? { approved_by: operatorId } 
        : { rejected_by: operatorId, rejection_reason: rejectReason };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast(`Request ${action.toUpperCase()}D`, 'success', `Leave request status updated.`);
        fetchLeaveData();
      } else {
        showToast('Action Failed', 'error', 'Error updating leave request status.');
      }
    } catch (e) {
      showToast('System Error', 'error', 'Kernel connection lost.');
    }
  };

  const fetchTrainingData = async () => {
    setIsTrainingLoading(true);
    try {
      const [progsRes, alertsRes] = await Promise.all([
        fetch(`${API}/hr/training/programs`),
        fetch(`${API}/hr/training/alerts`)
      ]);
      if (progsRes.ok) {
        const d = await progsRes.json();
        setTrainingPrograms(d.programs || []);
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setTrainingAlerts(d.alerts || []);
      }
    } catch (e) {
      console.error('Failed to fetch training data', e);
    } finally {
      setIsTrainingLoading(false);
    }
  };

  const createTrainingProgram = async () => {
    if (!trainingFormData.name) {
      showToast('Error', 'error', 'Program name is required.');
      return;
    }
    try {
      const res = await fetch(`${API}/hr/training/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingFormData)
      });
      if (res.ok) {
        showToast('Program Created', 'success', 'Training course registered.');
        fetchTrainingData();
        setTrainingFormData({
          name: '',
          category: 'HACCP',
          description: '',
          expiry_months: 12,
          is_mandatory: false,
          applicable_depts: []
        });
      } else {
        showToast('Failed to Create', 'error', 'Validation error.');
      }
    } catch (e) {
      showToast('System Error', 'error', 'Training service unreachable.');
    }
  };

  const enrollEmployees = async () => {
    if (!selectedProgForEnroll || selectedStaffForEnroll.length === 0) {
      showToast('Error', 'error', 'Select program and at least one employee.');
      return;
    }
    try {
      const res = await fetch(`${API}/hr/training/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: Number(selectedProgForEnroll),
          employee_ids: selectedStaffForEnroll,
          notes: 'Standard certification mandate.'
        })
      });
      if (res.ok) {
        showToast('Enrolled successfully', 'success', 'Directives created on Synapse Kanban.');
        fetchTrainingData();
        setSelectedStaffForEnroll([]);
      } else {
        showToast('Enrollment Failed', 'error', 'Ensure all fields are valid.');
      }
    } catch (e) {
      showToast('System Error', 'error', 'Training service unreachable.');
    }
  };

  useEffect(() => {
    if (activeTab === 'TALENT_ENGINE') fetchSTEData();
    if (activeTab === 'COMPLIANCE') fetchComplianceData();
    if (activeTab === 'LEAVE') fetchLeaveData();
    if (activeTab === 'TRAINING') fetchTrainingData();
  }, [activeTab]);

  const saveRegistry = (newRegistry: Operative[]) => {
    setStaffRegistry(newRegistry);
    localStorage.setItem('miracle_hr_vault', JSON.stringify(newRegistry));
  };

  // 2. DOCUMENT LIBRARY & EDITOR STATE (Medical-Grade Standards)
  const [libraryDocs, setLibraryDocs] = useState([
    { id: 'doc-1', title: 'Miracle HMS General Handbook (Clinical Std)', type: 'HANDBOOK' },
    { id: 'doc-2', title: 'Housekeeping SOP (Luxury Level)', type: 'SOP' },
    { id: 'doc-3', title: 'IT Security Protocols (Confidential)', type: 'POLICY' },
    { id: 'doc-4', title: 'Blank Office Expenditure Request', type: 'FORM' }
  ]);
  
  const [uploadCategory, setUploadCategory] = useState('SOP');
  const [editorContent, setEditorContent] = useState('<div style="color:#888; text-align:center; padding-top:50px;">Select a document or operative to load the editor...</div>');
  const [activeDocTitle, setActiveDocTitle] = useState('NO ACTIVE DOCUMENT');
  const printRef = useRef<HTMLDivElement>(null);

  // 📝 MIRACLE WORD MODULE DRAFTS
  const [drafts, setDrafts] = useState<any[]>([]);

  const fetchDrafts = useCallback(async () => {
    try {
      const authorId = localStorage.getItem('operative_id') || 'HR-ADMIN';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/drafts/${authorId}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch(e) { console.error("Failed to fetch drafts", e); }
  }, []);

  useEffect(() => {
    if (activeTab === 'DOCUMENTS') fetchDrafts();
  }, [activeTab, fetchDrafts]);

  const handleSaveDraft = async () => {
    try {
      const authorId = localStorage.getItem('operative_id') || 'HR-ADMIN';
      const payload = { author_id: authorId, title: activeDocTitle, content: editorContent };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Draft Saved', 'success', 'Draft securely saved to Master Kernel.');
        fetchDrafts();
      } else { showToast('Draft Error', 'error', 'Failed to save draft.'); }
    } catch(e) { showToast('Draft Error', 'error', 'Kernel Unreachable'); }
  };

  const handleDeleteDraft = async (draftId: number) => {
    const confirmed = await showConfirm({
      title: 'DELETE DRAFT', message: 'Delete this draft? It cannot be recovered.', icon: '🗑️',
      options: [{ label: 'DELETE', value: 'yes', variant: 'danger' }, { label: 'CANCEL', value: 'no', variant: 'cancel' }]
    });
    if (confirmed === 'yes') {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/drafts/${draftId}`, { method: 'DELETE' });
        if (res.ok) {
          showToast('Draft Deleted', 'success', 'Draft purged from Master Kernel.');
          fetchDrafts();
        } else { showToast('Draft Error', 'error', 'Failed to delete draft.'); }
      } catch(e) { showToast('Draft Error', 'error', 'Kernel Unreachable'); }
    }
  };

  // 3. ONBOARDING FORM & ASSET STATE
  const [formData, setFormData] = useState({
    name: '', lastName: '', pos: '', sal: 18500, comm: 3.45, dept: 'Front Desk & Reservations', role: 'STAFF', adminKey: '',
    joining_date: new Date().toISOString().split('T')[0],  // Today's date default
    off_days: 1,        // Off days per week
    working_hours: 176,  // Default monthly hours (8h x 22 days)
    gender: 'UNSPECIFIED' as 'MALE' | 'FEMALE' | 'UNSPECIFIED'
  });
  // SOVEREIGN HR V2: Multi-department alignment state
  const [deptAlignments, setDeptAlignments] = useState<string[]>([]);
  const [executiveTier, setExecutiveTier] = useState('OPERATIVE');
  const [industryVerticals] = useState<string[]>(['Hospitality']);

  // 🛡️ ROTH & CDO LOGIC: DUAL IMAGE ISOLATION
  const [biometricFile, setBiometricFile] = useState<File | null>(null);
  const [bioPreviewUrl, setBioPreviewUrl] = useState<string | null>(null);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  // 🛡️ STATE: Holds the Auto-Generated Passwords for UI Display
  const [onboardedCredentials, setOnboardedCredentials] = useState<{id: string, user: string, pass: string} | null>(null);

  // ==========================================
  // FUNCTIONAL HANDLERS (The "Work" Engines)
  // ==========================================
  const handleBioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setBiometricFile(file);
      setBioPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpdateDossierImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedStaff) {
      try {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/upload-avatar/${selectedStaff.id}`, { method: 'POST', body: formData });
        const data = await res.json();
        setSelectedStaff({...selectedStaff, img: data.url});
        showToast('Avatar Override Success', 'success', `Visual identity updated for ${selectedStaff.id}.`);
      } catch(e) {
        showToast('System Error', 'error', 'Failed to update avatar.');
      }
    }
  };

  const handleRegistryImageUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        try {
          const file = e.target.files[0];
          const formData = new FormData();
          formData.append('image', file);
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/upload-avatar/${id}`, { method: 'POST', body: formData });
          const data = await res.json();
          setStaffRegistry(prev => prev.map(s => s.id === id ? {...s, img: data.url} : s));
          showToast('Avatar Override Success', 'success', `Visual identity updated for operative ${id}.`);
        } catch(e) {
          showToast('System Error', 'error', 'Failed to upload image.');
        }
      }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.lastName.trim()) {
      showToast('Audit Error', 'error', 'Legal Name and Last Name required.');
      return;
    }
    if (!formData.joining_date) {
      showToast('Audit Error', 'error', 'Joining Date is required.');
      return;
    }
    if (deptAlignments.length === 0) {
      showToast('Audit Error', 'error', 'At least one Department Alignment is required.');
      return;
    }

    const payload = new FormData();
    payload.append('name', formData.name);
    payload.append('last_name', formData.lastName);
    payload.append('pos', formData.pos);
    payload.append('sal', formData.sal.toString());
    payload.append('comm', formData.comm.toString());
    payload.append('dept', deptAlignments[0] || formData.dept); // primary dept
    payload.append('dept_alignments', JSON.stringify(deptAlignments));
    payload.append('exec_tier', executiveTier);
    payload.append('industry_verticals_json', JSON.stringify(industryVerticals));
    payload.append('role', formData.role);
    payload.append('joining_date', formData.joining_date);
    payload.append('off_days', formData.off_days.toString());
    payload.append('working_hours', formData.working_hours.toString());
    payload.append('gender', formData.gender || 'UNSPECIFIED');
    if (formData.adminKey) payload.append('admin_key', formData.adminKey);
    if (biometricFile) payload.append('photo', biometricFile);
    if (avatarFile) payload.append('avatar_image', avatarFile);

    setIsKernelSyncing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/onboard`, { method: 'POST', body: payload });
      const data = await response.json();
      if (response.ok) {
        await fetchSovereignRegistry();
        setOnboardedCredentials({ 
            id: data.id, 
            user: data.credentials.user, 
            pass: data.credentials.pass 
        });
        resetFormInputs();
      } else {
        const errorMsg = data.detail || JSON.stringify(data);
        showToast('Kernel Rejected', 'error', errorMsg);
      }
    } catch (error) { 
      showToast('Fatal Error', 'error', 'Cannot reach Kernel Database. Onboarding Aborted.');
    } finally {
        setIsKernelSyncing(false);
    }
  };

  const resetFormInputs = () => {
    setFormData({ name: '', lastName: '', pos: '', sal: 18500, comm: 3.45, dept: 'Front Desk & Reservations', role: 'STAFF', adminKey: '', joining_date: new Date().toISOString().split('T')[0], off_days: 1, working_hours: 176, gender: 'UNSPECIFIED' });
    setDeptAlignments([]);
    setExecutiveTier('OPERATIVE');
    setBiometricFile(null); setBioPreviewUrl(null);
    setAvatarFile(null); setAvatarPreviewUrl(null);
  };

  const handleRegistryEdit = (id: string, field: string, value: any) => {
    const updated = staffRegistry.map(s => s.id === id ? { ...s, [field]: value } : s);
    saveRegistry(updated);
  };

  const handleRegistrySync = async () => {
    setIsKernelSyncing(true);
    try {
      const payload = staffRegistry.map(s => ({
        id: s.id, 
        sal: Number(s.sal), 
        commRate: Number(s.commRate), 
        status: s.status,
        img: s.img,
        username: s.username,
        password: s.password,
        role: s.role
      }));
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/sync-registry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const currentUser = localStorage.getItem('miracle_user');
        if (currentUser) {
          const me = staffRegistry.find(
            s => (s.username || '').toUpperCase() === currentUser.toUpperCase()
          );
          if (me && me.role) {
            localStorage.setItem('vigilant_role', me.role.toUpperCase());
            localStorage.setItem('miracle_hr_vault', JSON.stringify(staffRegistry));
          }
        }
        showToast('Override Accepted', 'success', 'Registry synchronized. Reloading session to unlock new zones...');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showToast('Kernel Offline', 'error', 'Sync failed.');
      }
    } catch (error) { 
        showToast('Kernel Offline', 'error', 'Sync failed.'); 
    } finally {
        setIsKernelSyncing(false);
    }
  };

  const executePayrollSync = async (staff: Operative) => {
    setIsKernelSyncing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/hr/execute-payroll/${staff.id}`, { method: 'POST' });
      if (response.ok) {
          const data = await response.json();
          showToast('Financial Handshake Complete', 'success', `Payslip generated for ${staff.name}. Liability ${formatMoney(data.amount_locked)} documented.`);
      } else {
          showToast('Sync Failed', 'error', 'Operative not found in Database.');
      }
    } catch (e) { showToast('Sync Failed', 'error', 'Kernel Offline'); }
    finally { setIsKernelSyncing(false); }
  };

  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newDoc = { id: `doc-${Date.now()}`, title: file.name.replace('.pdf', '').replace('.docx', ''), type: uploadCategory };
      setLibraryDocs([...libraryDocs, newDoc]);
      showToast('System Log', 'success', `New ${uploadCategory} "${file.name}" synchronized to Kernel Vault.`);
    }
  };

  const handleViewDoc = (doc: any) => {
    setActiveDocTitle(`VIEWING: ${doc.title}`);
    setEditorContent(`
      <h2 style="color:#000; text-align:center;">${doc.title}</h2>
      <p style="color:#333; margin-top:20px;">[System Notification: Live PDF bridging from Python Kernel will render here. Currently in Editor Mode.]</p>
    `);
  };

  const handleGenerateLetter = (staffId: string) => {
    const staff = staffRegistry.find(s => s.id === staffId);
    if (!staff) return;

    const today = new Date().toLocaleDateString();
    setActiveDocTitle(`APPOINTMENT LETTER: ${staff.name} ${staff.lastName}`);
    
    setEditorContent(`
      <div style="text-align: right; color: #333; margin-bottom: 30px;">
        <b>Date:</b> ${today}<br/>
        <b>Ref ID:</b> HR-${staff.id}-${new Date().getFullYear()}
      </div>
      <div style="color: #000; font-size: 14px; line-height: 1.8;">
        <b>To: ${staff.name} ${staff.lastName}</b><br/>
        <b>ID: ${staff.id}</b><br/><br/>
        <b>Subject: Letter of Appointment - ${staff.pos}</b><br/><br/>
        Dear ${staff.name},<br/><br/>
        Following your interview, we are pleased to offer you the position of <b>${staff.pos}</b> at <b>Miracle HMS Hospital</b>. 
        As an esteemed member of our team, your starting base salary will be <b>${formatMoney(staff.sal)}</b> per month, with a performance commission rate of <b>${staff.commRate}%</b>.<br/><br/>
        You are expected to uphold the Medical-Grade luxury standards as mandated by the Chief Development Officer. 
        Your biometric access has been pre-authorized for Zone: ${staff.dept} under the role <b>${staff.role}</b>.<br/><br/>
        Please sign below to indicate your acceptance of these terms.<br/><br/><br/>
        <div style="display:flex; justify-content: space-between; margin-top: 50px;">
          <div style="border-top: 1px solid #000; width: 200px; text-align:center; padding-top:5px;">Operative Signature</div>
          <div style="border-top: 1px solid #000; width: 200px; text-align:center; padding-top:5px;">CDO Authorization</div>
        </div>
      </div>
    `);
  };

  const handleGeneratePayslip = (staffId: string) => {
    const staff = staffRegistry.find(s => s.id === staffId);
    if (!staff) return;
    
    const bonus = staff.revImpact * (staff.commRate / 100);
    const total = staff.sal + bonus;
    const today = new Date().toLocaleDateString();

    setActiveDocTitle(`OFFICIAL PAYSLIP: ${staff.name} ${staff.lastName} - ${today}`);
    setEditorContent(`
      <div style="text-align: right; color: #333; margin-bottom: 30px;">
        <b>Date:</b> ${today}<br/>
        <b>Voucher ID:</b> PAY-${staff.id}-${Date.now()}
      </div>
      <div style="color: #000; font-size: 14px; line-height: 1.8;">
        <h2 style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 10px; color: #D4AF37;">MIRACLE HMS OFFICIAL PAYSLIP</h2>
        <b>Operative Asset:</b> ${staff.name} ${staff.lastName} (${staff.id})<br/>
        <b>Designation:</b> ${staff.pos}<br/>
        <b>Department Alignment:</b> ${staff.dept}<br/><br/>

        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr style="border-bottom: 1px solid #ccc; background: #f9f9f9;">
            <th style="padding: 10px; text-align:left;">EARNINGS BREAKDOWN</th>
            <th style="padding: 10px; text-align:right;">AMOUNT ({currency})</th>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px;">Contractual Base Salary</td>
            <td style="text-align:right; padding: 12px 10px;">${formatMoney(staff.sal)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 10px;">Performance Commission (${staff.commRate}% on ${formatMoney(staff.revImpact)})</td>
            <td style="text-align:right; padding: 12px 10px;">${formatMoney(bonus)}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000; font-weight: 900; font-size: 18px;">
            <td style="padding: 15px 10px;">TOTAL NET PAYOUT</td>
            <td style="text-align:right; padding: 15px 10px; color: #008844;">${formatMoney(total)}</td>
          </tr>
        </table>

        <br/><br/>
        <div style="display:flex; justify-content: space-between; margin-top: 60px;">
          <div style="border-top: 1px solid #000; width: 200px; text-align:center; padding-top:5px; font-size: 11px;">System Generated (Miracle HMS)</div>
          <div style="border-top: 1px solid #000; width: 200px; text-align:center; padding-top:5px; font-size: 11px;">Chief Development Officer</div>
        </div>
      </div>
    `);
    
    setActiveTab('DOCUMENTS');
    setSelectedStaff(null);
  };

  const executePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${activeDocTitle}</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; margin: 0; background: white; }
              .letterhead { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; margin-bottom: 40px; }
              .letterhead h1 { color: #000; margin: 0; font-size: 28px; letter-spacing: 2px; text-transform: uppercase; }
              .letterhead p { color: #555; margin: 5px 0 0 0; font-size: 12px; }
              @media print { @page { margin: 15mm; } }
            </style>
          </head>
          <body>
            <div class="letterhead">
              <h1>MIRACLE HMS HOSPITAL</h1>
              <p>SECURE HEALTHCARE PORTAL | MIRACLE HMS VERIFIED</p>
            </div>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
    }
  };

  const totalPayroll = useMemo(() => {
    return staffRegistry.reduce((acc, s) => acc + s.sal + (s.revImpact * (s.commRate / 100)), 0);
  }, [staffRegistry]);

  return (
    <div className={isViewMode ? 'zone-view-mode' : ''} style={mainViewport}>
      <ViewModeBanner />
      
      {/* MASTER HEADER */}
      <div style={headerFrame}>
        <div>
          <h1 style={titleStyle}>👥 HUMAN CAPITAL COMMAND</h1>
          <div style={subTitleStyle}>
            SUPREME REGISTRY LOCK | MIRACLE HMS v27.0
            {isKernelSyncing && <span style={{ color: '#FF3131', marginLeft: '15px', animation: 'pulse 1.5s infinite' }}>📡 SYNCING WITH DB...</span>}
          </div>
        </div>
        <div style={telemetryChip}>TOTAL LIABILITY: {formatMoney(totalPayroll)}</div>
      </div>

      {/* EXPANDED TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        {(['GALLERY', 'PERFORMANCE', 'PAYROLL', 'DOCUMENTS', 'ONBOARDING', 'REGISTRY', 'MY_SOP'] as const).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setOnboardedCredentials(null); }} style={tabStyle(activeTab === t, t === 'REGISTRY' ? '#FF3131' : '#00F2FF')}>
            {t}
          </button>
        ))}
        <button onClick={() => setActiveTab('TALENT_ENGINE')} style={tabStyle(activeTab === 'TALENT_ENGINE', '#FF8C00')}>
          🧠 TALENT ENGINE {steStats.new_unreviewed_applications > 0 ? `(${steStats.new_unreviewed_applications} NEW)` : ''}
        </button>
        <button onClick={() => setActiveTab('COMPLIANCE')} style={tabStyle(activeTab === 'COMPLIANCE', '#FF8C00')}>
          ⚖️ COMPLIANCE
        </button>
        <button onClick={() => setActiveTab('LEAVE')} style={tabStyle(activeTab === 'LEAVE', '#00F2FF')}>
          📅 LEAVE
        </button>
        <button onClick={() => setActiveTab('TRAINING')} style={tabStyle(activeTab === 'TRAINING', '#39FF14')}>
          🎓 TRAINING
        </button>
        <button onClick={() => setActiveTab('WORKFORCE_INTEL')} style={tabStyle(activeTab === 'WORKFORCE_INTEL', '#D4AF37')}>
          📊 WORKFORCE INTEL
        </button>
      </div>

      <div style={contentBox}>
        
        {/* VIEW A: BIOMETRIC GALLERY (RETINA GLASS) */}
        {activeTab === 'GALLERY' && (
          <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '30px', animation: 'fadeIn 0.5s ease', alignItems: 'start' }}>
            {/* LEFT FREEZE BAR */}
            <div style={{ position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#00F2FF', fontSize: '11px', fontWeight: 900, letterSpacing: '2px', marginBottom: '15px' }}>DEPARTMENT CATEGORY</div>
              
              <button onClick={() => setSelectedGalleryCategory('ALL')} style={{ ...ghostBtn, textAlign: 'left', background: selectedGalleryCategory === 'ALL' ? 'rgba(0,242,255,0.15)' : 'transparent', color: selectedGalleryCategory === 'ALL' ? '#00F2FF' : '#888', border: selectedGalleryCategory === 'ALL' ? '1px solid #00F2FF' : '1px solid transparent', padding: '12px 15px' }}>
                ALL DEPARTMENTS
              </button>
              {Object.entries(DEPT_TAXONOMY).map(([key, data]) => (
                <button key={key} onClick={() => setSelectedGalleryCategory(key)} style={{ ...ghostBtn, textAlign: 'left', background: selectedGalleryCategory === key ? 'rgba(0,242,255,0.15)' : 'transparent', color: selectedGalleryCategory === key ? '#00F2FF' : '#888', border: selectedGalleryCategory === key ? '1px solid #00F2FF' : '1px solid transparent', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{data.emoji}</span> <span>{data.label}</span>
                </button>
              ))}
            </div>

            {/* RIGHT SCROLLABLE GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px', alignContent: 'start' }}>
              {staffRegistry.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: '#888', fontFamily: 'Cinzel' }}>
                      <h2>NO OPERATIVES FOUND IN DATABASE</h2>
                      <p>Proceed to ONBOARDING to register staff.</p>
                  </div>
              ) : (
                  staffRegistry
                    .filter(staff => {
                      if (selectedGalleryCategory === 'ALL') return true;
                      // Determine if staff matches category
                      // Check industry verticals or dept_alignments (but we don't know for sure, so we check if dept or alignments are in the category's departments)
                      const deptList = DEPT_TAXONOMY[selectedGalleryCategory]?.departments || [];
                      const staffDepts = (staff.dept_alignments && staff.dept_alignments.length > 0) ? staff.dept_alignments : [staff.dept];
                      // Also we can just map the category keys directly since they're in industry_verticals! Wait, did they use DEPT_TAXONOMY keys for industry verticals? Yes!
                      if (staff.industry_verticals && staff.industry_verticals.includes(selectedGalleryCategory)) return true;
                      
                      // Fallback: check if any of the staff's departments match the category's departments list
                      return staffDepts.some(d => deptList.includes(d));
                    })
                    .map(staff => (
                      <div key={staff.id} onClick={() => setSelectedStaff(staff)} className="glass-card" style={staffCard(staff.status === 'ON-DUTY')}>
                          <div style={statusBadge(staff.status)}>{staff.status}</div>
                          {staff.executive_tier && staff.executive_tier !== 'OPERATIVE' && (
                            <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em', padding: '2px 7px', borderRadius: '10px', background: staff.executive_tier === 'BOARD' ? 'rgba(255,51,102,0.2)' : staff.executive_tier === 'C-SUITE' ? 'rgba(212,175,55,0.2)' : staff.executive_tier === 'DIRECTOR' ? 'rgba(168,85,247,0.2)' : 'rgba(0,251,255,0.15)', color: staff.executive_tier === 'BOARD' ? '#ff3366' : staff.executive_tier === 'C-SUITE' ? '#D4AF37' : staff.executive_tier === 'DIRECTOR' ? '#a855f7' : '#00fbff', border: `1px solid currentColor` }}>{staff.executive_tier}</div>
                          )}
                          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
                            <div style={avatarCircle}>
                              {staff.img ? (
                                <img
                                  src={staff.img.startsWith('blob:') ? staff.img : `${process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '/api'}${staff.img}`}
                                  style={{width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover'}}
                                  alt={staff.name}
                                />
                              ) : <span style={{fontSize:'36px'}}>👤</span>}
                            </div>
                            {staff.is_online && (
                              <span style={{ position: 'absolute', bottom: '0', right: '0', width: '16px', height: '16px', borderRadius: '50%', background: '#00F2FF', border: '3px solid #080812', boxShadow: '0 0 10px #00F2FF', display: 'block' }} title="Online on Synapse Nexus" />
                            )}
                          </div>
                          <h3 style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontSize: '18px', margin: '15px 0 3px 0' }}>{staff.name}</h3>
                          <p style={{ fontSize: '10px', color: '#888', fontWeight: 900, margin: '0 0 8px 0' }}>{staff.pos}</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                            {(staff.dept_alignments && staff.dept_alignments.length > 0 ? staff.dept_alignments : [staff.dept]).filter(Boolean).slice(0,3).map((d, i) => (
                              <span key={d} style={{ fontSize: '8px', padding: '2px 6px', borderRadius: '8px', background: i === 0 ? 'rgba(212,175,55,0.15)' : 'rgba(0,251,255,0.1)', color: i === 0 ? '#D4AF37' : '#00fbff', border: `1px solid ${i === 0 ? 'rgba(212,175,55,0.3)' : 'rgba(0,251,255,0.2)'}` }}>{d}</span>
                            ))}
                            {staff.dept_alignments && staff.dept_alignments.length > 3 && <span style={{ fontSize: '8px', color: '#6b7280' }}>+{staff.dept_alignments.length - 3}</span>}
                          </div>
                          <div style={miniStatRow}>
                            <span>ROI: <b style={{color: '#D4AF37'}}>{staff.roi_score || '0x'}</b></span>
                            <span>EFF: <b style={{color: '#39FF14'}}>{staff.efficiency}%</b></span>
                          </div>
                      </div>
                    ))
              )}
            </div>
          </div>
        )}

        {/* VIEW B: PERFORMANCE ANALYTICS — 3D SUITE */}
        {activeTab === 'PERFORMANCE' && (() => {
          // Compute dept-level stats from live staffRegistry
          const deptMap: Record<string, { total: number; effSum: number; count: number; color: string }> = {};
          const DEPT_COLORS: Record<string, string> = {
            'HK': '#00F2FF', 'RS': '#D4AF37', 'MN': '#FF8C00', 'SPA': '#9D50BB',
            'FO': '#00FF88', 'IT': '#FF3131', 'GYM': '#39FF14', 'POOL': '#00D4FF',
            'ADMIN': '#888', 'KITCHEN': '#FF6B6B', 'BAR': '#F59E0B',
          };
          staffRegistry.forEach(s => {
            const dept = (s.dept || 'OTHER').split('-').pop()?.toUpperCase() || 'OTHER';
            if (!deptMap[dept]) deptMap[dept] = { total: 0, effSum: 0, count: 0, color: DEPT_COLORS[dept] || '#555' };
            deptMap[dept].effSum += s.efficiency || 0;
            deptMap[dept].total += s.sal;
            deptMap[dept].count++;
          });
          const deptStats = Object.entries(deptMap).map(([dept, d]) => ({
            dept,
            avgEff: d.count > 0 ? Math.round(d.effSum / d.count) : 0,
            headcount: d.count,
            payroll: d.total,
            color: d.color,
          }));

          const onDutyCount = staffRegistry.filter(s => s.status === 'ON-DUTY').length;
          const avgEffAll = staffRegistry.length > 0 ? Math.round(staffRegistry.reduce((s, r) => s + (r.efficiency || 0), 0) / staffRegistry.length) : 0;

          return (
            <div style={{ animation: 'fadeIn 0.5s ease' }}>
              <style>{`
                @keyframes hrSpin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
                @keyframes hrBarFill { from{width:0;}to{} }
                @keyframes hrSlideUp { from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);} }
              `}</style>

              {/* TOP KPI ROW */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'16px', marginBottom:'28px', animation:'hrSlideUp 0.4s ease' }}>
                {[
                  { label:'TOTAL OPERATIVES', value:staffRegistry.length, unit:'STAFF', color:'#00F2FF' },
                  { label:'ON DUTY NOW', value:onDutyCount, unit:'ACTIVE', color:'#00FF88' },
                  { label:'AVG EFFICIENCY', value:`${avgEffAll}%`, unit:'OVERALL', color:'#D4AF37' },
                  { label:'DEPARTMENTS', value:deptStats.length, unit:'DIVISIONS', color:'#9D50BB' },
                ].map((kpi, i) => (
                  <div key={i} style={{ padding:'20px', background:'rgba(255,255,255,0.02)', border:`1px solid ${kpi.color}22`, borderRadius:'16px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${kpi.color},transparent)` }} />
                    <div style={{ fontSize:'9px', color:'#555', letterSpacing:'2px', fontWeight:900 }}>{kpi.label}</div>
                    <div style={{ fontSize:'26px', fontWeight:900, fontFamily:'monospace', color:kpi.color, marginTop:'6px', textShadow:`0 0 15px ${kpi.color}44` }}>{kpi.value}</div>
                    <div style={{ fontSize:'9px', color:'#444', marginTop:'4px', letterSpacing:'1px' }}>{kpi.unit}</div>
                  </div>
                ))}
              </div>

              {/* DEPARTMENT EFFICIENCY SPEEDOMETERS */}
              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'20px', padding:'24px', marginBottom:'24px' }}>
                <div style={{ fontSize:'10px', color:'#888', fontWeight:900, letterSpacing:'2px', marginBottom:'24px' }}>DEPARTMENT EFFICIENCY SPEEDOMETERS</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'16px' }}>
                  {deptStats.map((d, idx) => {
                    const r2 = 44; const cx = 52; const cy = 52;
                    const toRad = (deg: number) => (deg * Math.PI) / 180;
                    const startA = -180; const arcA = (Math.min(d.avgEff, 100) / 100) * 180;
                    const sx = cx + r2 * Math.cos(toRad(startA));
                    const sy = cy + r2 * Math.sin(toRad(startA));
                    const ex = cx + r2 * Math.cos(toRad(startA + arcA));
                    const ey = cy + r2 * Math.sin(toRad(startA + arcA));
                    const large = arcA > 180 ? 1 : 0;
                    return (
                      <div key={idx} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', padding:'16px 10px', background:'rgba(255,255,255,0.02)', borderRadius:'14px', border:`1px solid ${d.color}22` }}>
                        <svg width="104" height="60" viewBox="0 0 104 60">
                          <path d={`M ${cx - r2} ${cy} A ${r2} ${r2} 0 0 1 ${cx + r2} ${cy}`} stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" strokeLinecap="round" />
                          {d.avgEff > 0 && <path d={`M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r2} ${r2} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`} stroke={d.color} strokeWidth="8" fill="none" strokeLinecap="round" style={{ filter:`drop-shadow(0 0 4px ${d.color})` }} />}
                          <text x={cx} y={cy} textAnchor="middle" fill={d.color} fontSize="13" fontWeight="900" fontFamily="monospace">{d.avgEff}%</text>
                        </svg>
                        <div style={{ fontSize:'10px', color:d.color, fontWeight:900, letterSpacing:'1px' }}>{d.dept}</div>
                        <div style={{ fontSize:'9px', color:'#555' }}>{d.headcount} staff</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STAFF TASK COMPLETION BAR CHART */}
              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'20px', padding:'24px', marginBottom:'24px' }}>
                <div style={{ fontSize:'10px', color:'#888', fontWeight:900, letterSpacing:'2px', marginBottom:'20px' }}>INDIVIDUAL EFFICIENCY VECTOR</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {[...staffRegistry].sort((a,b) => (b.efficiency||0)-(a.efficiency||0)).slice(0, 12).map((s, idx) => {
                    const eff = s.efficiency || 0;
                    const col = eff >= 80 ? '#00FF88' : eff >= 60 ? '#D4AF37' : '#FF3131';
                    return (
                      <div key={idx} style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                        <div style={{ fontSize:'11px', color:'#AAA', fontWeight:700, minWidth:'100px', maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name} {s.lastName}</div>
                        <div style={{ flex:1, height:'8px', background:'rgba(255,255,255,0.04)', borderRadius:'4px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${eff}%`, background:`linear-gradient(90deg, ${col}88, ${col})`, boxShadow:`0 0 8px ${col}44`, borderRadius:'4px', animation:'hrBarFill 1s cubic-bezier(0.16,1,0.3,1)' }} />
                        </div>
                        <div style={{ fontSize:'11px', color:col, fontFamily:'monospace', fontWeight:900, minWidth:'36px', textAlign:'right' }}>{eff}%</div>
                        <div style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'8px', background:`rgba(255,255,255,0.04)`, color:'#555', minWidth:'58px', textAlign:'center' }}>{s.status}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ORIGINAL ROSTER TABLE */}
              <div style={{ fontSize:'10px', color:'#555', fontWeight:900, letterSpacing:'2px', marginBottom:'12px' }}>FULL OPERATIVE ROSTER</div>
              <table style={tableStyle}>
                <thead>
                  <tr style={headerRow}><th>OPERATIVE ASSET</th><th>TIER</th><th>DEPT ALIGNMENTS</th><th>BASE SALARY</th><th>EFFICIENCY</th><th>ROI FACTOR</th></tr>
                </thead>
                <tbody>
                  {staffRegistry.map(s => (
                    <tr key={s.id} style={dataRow}>
                      <td style={{ padding: '20px' }}><b style={{color: '#00F2FF'}}>{s.name} {s.lastName}</b><br/><small style={{color:'#666'}}>{s.pos} | Joined: {s.joined}</small></td>
                      <td><span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '10px', background: 'rgba(0,251,255,0.1)', color: '#00fbff' }}>{s.executive_tier || 'OPERATIVE'}</span></td>
                      <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{(s.dept_alignments && s.dept_alignments.length > 0 ? s.dept_alignments : [s.dept]).filter(Boolean).map((d, i) => <span key={d} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', background: i===0?'rgba(212,175,55,0.15)':'rgba(255,255,255,0.05)', color: i===0?'#D4AF37':'#9ca3af' }}>{d}</span>)}</div></td>
                      <td>{formatMoney(s.sal)}</td>
                      <td style={{ color: '#D4AF37' }}>{s.efficiency}%</td>
                      <td style={{ color: '#00F2FF', fontWeight: 900 }}>{s.roi_score || '0x Factor'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}



        {/* VIEW C: PAYROLL & EXPENDITURE */}
        {activeTab === 'PAYROLL' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={headerRow}><th>ID</th><th>OPERATIVE</th><th>ENTITLED MONTHLY HOURS</th><th>ACHIEVED MONTHLY HOURS</th><th>TOTAL COMMISSION EARNED</th><th>TOTAL PAYOUT</th><th>ACCOUNTS STATUS</th></tr>
              </thead>
              <tbody>
                {staffRegistry.map(s => {
                  const total = s.total_monthly || (s.sal + (s.commission || 0));
                  const now = new Date();
                  // Payout turns green if it's past the 5th day of the month after 12:00 AM
                  const isPast5th = now.getDate() >= 5;
                  
                  return (
                    <tr key={s.id} style={dataRow}>
                      <td style={{ color: '#888', padding: '20px' }}>{s.id}</td>
                      <td><b>{s.name} {s.lastName}</b><br/><small style={{color:'#666'}}>{s.pos}</small></td>
                      <td style={{ color: '#888', fontWeight: 600 }}>176 HRS</td>
                      <td style={{ fontWeight: 900, color: (s.hours_month || 0) >= 176 ? '#00F2FF' : '#fff' }}>{s.hours_month || 0} HRS</td>
                      <td style={{ color: '#D4AF37', fontWeight: 600 }}>{formatMoney(s.commission || 0)}</td>
                      <td style={{ color: isPast5th ? '#39FF14' : '#D4AF37', fontWeight: 900 }}>{formatMoney(total)}</td>
                      <td><button onClick={() => executePayrollSync(s)} style={actionBtn('#D4AF37', '9px', '10px 15px')}>PUSH TO ACCOUNTS & INBOX</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW D: DOCUMENTS, FORGE & EDITOR */}
        {activeTab === 'DOCUMENTS' && (
          <div style={{ animation: 'fadeIn 0.5s ease', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              <div style={glassPanel('#00F2FF')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h4 style={{ color: '#00F2FF', fontFamily: 'Cinzel', margin: 0 }}>📚 DUBAI 5-STAR VAULT</h4>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} style={selectStyle}>
                      <option value="HANDBOOK">HANDBOOK</option>
                      <option value="SOP">SOP</option>
                      <option value="POLICY">POLICY</option>
                    </select>
                    <label style={uploadBtn}>
                      <input type="file" accept=".pdf,.doc,.docx" onChange={handleUploadTemplate} style={{ display: 'none' }} />
                      + UPLOAD
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                  {libraryDocs.map(doc => (
                    <div key={doc.id} style={docItem}>
                      <div><span style={{ color: '#00F2FF', fontWeight: 900, fontSize: '9px', marginRight: '10px' }}>[{doc.type}]</span><span>{doc.title}</span></div>
                      <button onClick={() => handleViewDoc(doc)} style={ghostBtn}>LOAD TO EDITOR</button>
                    </div>
                  ))}
                  {drafts.length > 0 && <div style={{ borderTop: '1px solid #00F2FF33', marginTop: '10px', paddingTop: '10px' }} />}
                  {drafts.map(draft => (
                    <div key={`draft-${draft.id}`} style={{...docItem, borderLeft: '3px solid #00FF88'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                        <div><span style={{ color: '#00FF88', fontWeight: 900, fontSize: '9px', marginRight: '10px' }}>[DRAFT]</span><span style={{color: '#FFF'}}>{draft.title}</span></div>
                        <div style={{fontSize: '8px', color: '#666', marginTop: '4px'}}>{new Date(draft.updated_at).toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => { setActiveDocTitle(draft.title); setEditorContent(draft.content); }} style={ghostBtn}>LOAD</button>
                        <button onClick={() => handleDeleteDraft(draft.id)} style={{...ghostBtn, color: '#FF3131', borderColor: '#FF3131'}}>DEL</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={glassPanel('#D4AF37')}>
                <h4 style={{ color: '#D4AF37', fontFamily: 'Cinzel', marginBottom: '20px' }}>⚖️ APPOINTMENT LETTER FORGE</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                  {staffRegistry.map(s => (
                    <div key={s.id} style={docItem}>
                      <div><b style={{ color: '#FFF', fontSize: '12px' }}>{s.name}</b> <span style={{ color: '#666', fontSize: '10px', marginLeft: '10px' }}>{s.id}</span></div>
                      <button onClick={() => handleGenerateLetter(s.id)} style={{...actionBtn('#D4AF37', '8px', '8px 15px'), width: 'auto', marginTop: 0}}>GENERATE IN EDITOR</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#1E1E1E', padding: '20px', borderRadius: '15px', border: '1px solid #444', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                <div style={{ color: '#FFF', fontSize: '12px', fontWeight: 900 }}>📝 MIRACLE WORD MODULE <span style={{ color: '#00F2FF', fontSize: '10px', fontWeight: 'normal' }}>| {activeDocTitle}</span></div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSaveDraft} style={{...ghostBtn, color: '#00FF88', borderColor: '#00FF88'}}>💾 SAVE DRAFT</button>
                  <button onClick={executePrint} style={{...ghostBtn, background: '#D4AF37', color: '#000', borderColor: '#D4AF37'}}>🖨️ PRINT / PDF EXPORT</button>
                </div>
              </div>
              <div 
                ref={printRef}
                contentEditable={true} suppressContentEditableWarning={true}
                onInput={(e) => setEditorContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: editorContent }}
                style={{ background: '#FFF', width: '100%', maxWidth: '800px', minHeight: '1050px', padding: '50px', boxShadow: '0px 10px 30px rgba(0,0,0,0.8)', color: '#000', fontFamily: '"Times New Roman", Times, serif', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* VIEW E: ONBOARDING TERMINAL (DUAL MATRIX + UI CREDENTIALS BANNER) */}
        {activeTab === 'ONBOARDING' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            
            {onboardedCredentials && (
              <div style={{ background: 'rgba(0, 255, 136, 0.1)', border: '1px solid #00FF88', padding: '25px', borderRadius: '16px', marginBottom: '30px', textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                <h3 style={{ color: '#00FF88', margin: '0 0 15px 0', fontFamily: 'Cinzel', letterSpacing: '2px' }}>✅ OPERATIVE SECURED TO POSTGRESQL</h3>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
                  <div><span style={{color: '#888', fontSize: '10px', display: 'block', marginBottom: '5px'}}>SYSTEM ID</span><b style={{color: '#FFF', fontSize: '18px'}}>{onboardedCredentials.id}</b></div>
                  <div><span style={{color: '#888', fontSize: '10px', display: 'block', marginBottom: '5px'}}>LOGIN USERNAME</span><b style={{color: '#00F2FF', fontSize: '18px'}}>{onboardedCredentials.user}</b></div>
                  <div><span style={{color: '#888', fontSize: '10px', display: 'block', marginBottom: '5px'}}>SECURE PASSWORD</span><b style={{color: '#FF3131', fontSize: '18px'}}>{onboardedCredentials.pass}</b></div>
                </div>
                <button onClick={() => setOnboardedCredentials(null)} style={{...ghostBtn, marginTop: '20px'}}>CLEAR NOTIFICATION</button>
              </div>
            )}

            <form onSubmit={handleOnboard} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '40px' }}>
              <div style={glassPanel('#D4AF37')}>
                <h4 style={{ color: '#D4AF37', fontFamily: 'Cinzel', marginBottom: '8px' }}>EXECUTIVE ONBOARDING TERMINAL</h4>
                <p style={{ color: '#6b7280', fontSize: '11px', marginBottom: '25px', letterSpacing: '0.05em' }}>MIRACLE HMS - Clinical & Administrative Registration</p>
                <div style={formGrid}>
                  <div><label style={labelStyle}>FIRST NAME</label><input style={inputStyle} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                  <div><label style={labelStyle}>LAST NAME (Auto-Login)</label><input style={inputStyle} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} required /></div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>DESIGNATION / TITLE</label><input style={inputStyle} value={formData.pos} onChange={e => setFormData({...formData, pos: e.target.value})} placeholder="e.g. Chief Finance Officer, IT Director, General Manager" /></div>
                </div>

                {/* SOVEREIGN DEPT ALIGNMENT MATRIX V2 */}
                <div style={{ margin: '20px 0', padding: '20px', borderRadius: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <DeptAlignmentMatrix
                    selectedDepts={deptAlignments}
                    onChange={setDeptAlignments}
                    executiveTier={executiveTier}
                    onTierChange={setExecutiveTier}
                  />
                </div>

                <div>
                  <label style={labelStyle}>ACCESS ZONE (RBAC CLEARANCE)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { val: 'CDO', label: 'SUPER ADMIN - ALL ZONES (incl. Master Grid, Financials)' },
                      { val: 'DIRECTOR', label: 'HOSPITAL DIRECTOR - ALL CLINICAL & ADMIN ZONES' },
                      { val: 'ADMIN', label: 'HOSPITAL ADMIN (HR, IT, Finance, Compliance)' },
                      { val: 'DOCTOR', label: 'PHYSICIAN (Z-DOCTOR: EMR, Prescriptions, Vitals)' },
                      { val: 'SURGEON', label: 'SURGEON (Z-OT: Operating Theater & EMR)' },
                      { val: 'SPECIALIST', label: 'MEDICAL SPECIALIST (Z-SPECIALIST)' },
                      { val: 'NURSE', label: 'CLINICAL STAFF (Z-NURSE: Wards, ICU, Triage)' },
                      { val: 'WARD_ADMIN', label: 'WARD ADMIN (Z-30: Bed Management)' },
                      { val: 'PHARMACY', label: 'PHARMACY (Z-12: Dispensary, Inventory)' },
                      { val: 'LAB', label: 'DIAGNOSTICS (Z-14: Lab Reports, Pathology)' },
                      { val: 'AMBULANCE', label: 'EMS & AMBULANCE (Z-28)' },
                      { val: 'FRONT_DESK', label: 'RECEPTION & OPD (Z-05, Z-10: Patient Intakes)' },
                      { val: 'PATIENT_GUIDE', label: 'PATIENT RELATIONS (Z-GUEST)' },
                      { val: 'HR', label: 'HR DEPT (Z-09: Payroll, Onboarding)' },
                      { val: 'ACC', label: 'ACCOUNTS (Z-11: Billing, Ledger)' },
                      { val: 'FACILITIES', label: 'MAINTENANCE & SECURITY (Z-16, Z-17)' },
                      { val: 'SYNAPSE', label: 'SYNAPSE NEXUS (Z-20: AI Core)' },
                    ].map(role => (
                      <label key={role.val} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', cursor: 'pointer', color: (formData.role || '').split(',').includes(role.val) ? '#00F2FF' : '#888', minHeight: '44px' }}>
                        <input
                          type="checkbox"
                          checked={(formData.role || '').split(',').includes(role.val)}
                          onChange={(e) => {
                            const current = (formData.role || '').split(',').filter(r => r);
                            const next = e.target.checked ? [...current, role.val] : current.filter(r => r !== role.val);
                            setFormData({...formData, role: next.join(',')});
                          }}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* GENDER SELECTOR */}
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>GENDER (AVATAR & HR REPORTING)</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    {(['MALE', 'FEMALE', 'UNSPECIFIED'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setFormData({...formData, gender: g})}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '8px',
                          border: formData.gender === g ? '2px solid #00F2FF' : '1px solid #333',
                          background: formData.gender === g ? 'rgba(0,242,255,0.12)' : 'rgba(0,0,0,0.3)',
                          color: formData.gender === g ? '#00F2FF' : '#666',
                          fontSize: '10px', fontWeight: 900, cursor: 'pointer', letterSpacing: '1px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {g === 'MALE' ? '👨 MALE' : g === 'FEMALE' ? '👩 FEMALE' : '⚪ UNSPECIFIED'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                  <div><label style={labelStyle}>BASE SALARY ({currency})</label><input type="number" style={inputStyle} value={formData.sal} onChange={e => setFormData({...formData, sal: Number(e.target.value)})} /></div>
                  <div><label style={labelStyle}>COMMISSION RATE (%)</label><input type="number" step="0.1" style={inputStyle} value={formData.comm} onChange={e => setFormData({...formData, comm: Number(e.target.value)})} /></div>
                </div>

                {(formData.role || '').split(',').some(r => ['ADMIN', 'GM', 'CDO'].includes(r)) && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{...labelStyle, color: '#FF3131'}}>CUSTOM ADMIN PASSWORD (OPTIONAL)</label>
                    <input type="text" style={{...inputStyle, border: '1px solid #FF3131'}} value={formData.adminKey} onChange={e => setFormData({...formData, adminKey: e.target.value})} placeholder="Leave blank for default 1212" />
                  </div>
                )}

                <button type="submit" id="btn-generate-dna" disabled={isKernelSyncing} style={{...actionBtn('#D4AF37', '12px', '20px'), cursor: isKernelSyncing ? 'wait' : 'pointer', marginTop: '24px'}}>
                  {isKernelSyncing ? 'WRITING TO DATABASE...' : `GENERATE DNA & AUTHORIZE ACCESS${deptAlignments.length > 0 ? ` (${deptAlignments.length} DEPT${deptAlignments.length > 1 ? 'S' : ''})` : ''}`}
                </button>
              </div>

              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. VISUAL AVATAR */}
                <div style={{...glassPanel('#00F2FF'), padding: '25px'}}>
                  <label style={labelStyle}>PERSONAL AVATAR (OPTIONAL UI IMAGE)</label>
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: 'rgba(0,0,0,0.6)', border: '2px dashed rgba(0, 242, 255, 0.4)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                    <input type="file" accept="image/*" onChange={handleAvatarFileChange} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                    {avatarPreviewUrl ? (
                      <img src={avatarPreviewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar Preview" />
                    ) : (
                      <>
                        <span style={{ fontSize: '30px', marginBottom: '5px' }}>🖼️</span>
                        <span style={{ color: '#00F2FF', fontWeight: 900, fontSize: '10px', letterSpacing: '1px' }}>UPLOAD STAFF PHOTO</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. SECURE BIOMETRICS */}
                <div style={{...glassPanel('#FF3131'), padding: '25px'}}>
                  <label style={labelStyle}>BIOMETRIC FINGERPRINT/RETINA (OPTIONAL)</label>
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: 'rgba(0,0,0,0.6)', border: '2px dashed rgba(255, 49, 49, 0.4)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                    <input type="file" accept="image/*" onChange={handleBioFileChange} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                    {bioPreviewUrl ? (
                      <div style={{color: '#FF3131', fontWeight: 900, fontSize: '14px', letterSpacing: '2px'}}>ENCRYPTED HASH SAVED ✓</div>
                    ) : (
                      <>
                        <span style={{ fontSize: '30px', marginBottom: '5px' }}>👁️</span>
                        <span style={{ color: '#FF3131', fontWeight: 900, fontSize: '10px', letterSpacing: '1px' }}>SCAN BIOMETRIC DATA</span>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </form>
          </div>
        )}

        {/* VIEW F: REGISTRY SURGERY (THE ROOT FIX: VISIBLE CREDENTIALS) */}
        {activeTab === 'REGISTRY' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h4 style={{ color: '#FF3131', fontFamily: 'Cinzel', margin: 0 }}>CORE REGISTRY SURGERY</h4>
              <button onClick={handleRegistrySync} disabled={isKernelSyncing} style={{ background: isKernelSyncing ? '#333' : 'linear-gradient(90deg, #FF3131 0%, #8B0000 100%)', color: '#FFF', border: '1px solid #FF3131', padding: '10px 20px', borderRadius: '8px', fontWeight: 900, cursor: isKernelSyncing ? 'wait' : 'pointer', letterSpacing: '2px', boxShadow: isKernelSyncing ? 'none' : '0 0 15px rgba(255,49,49,0.4)' }}>
                {isKernelSyncing ? 'SYNCING...' : '📡 AUTHORIZE GLOBAL SYNC'}
              </button>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={headerRow}>
                    <th>ID / ASSET</th>
                    <th>TIER</th>
                    <th>DEPT ALIGNMENTS</th>
                    <th>LOGIN ID</th>
                    <th>PASSWORD</th>
                    <th>ZONES / ROLE</th>
                    <th>SALARY</th>
                    <th>COMM %</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRegistry.map(s => (
                    <tr key={s.id} style={dataRow}>
                      <td style={{ padding: '15px' }}>
                        <b style={{ color: '#FFF' }}>{s.name} {s.lastName}</b><br/>
                        <span style={{ color: '#888', fontSize: '9px' }}>{s.id}</span>
                      </td>
                      <td><span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'rgba(0,251,255,0.1)', color: '#00fbff', fontWeight: 700 }}>{s.executive_tier || 'OPERATIVE'}</span></td>
                      <td style={{ maxWidth: '200px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(s.dept_alignments && s.dept_alignments.length > 0 ? s.dept_alignments : [s.dept]).filter(Boolean).map((d, i) => (
                            <span key={d} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '8px', whiteSpace: 'nowrap', background: i===0?'rgba(212,175,55,0.15)':'rgba(255,255,255,0.05)', color: i===0?'#D4AF37':'#9ca3af' }}>{d}</span>
                          ))}
                        </div>
                      </td>
                      <td><input style={ghostInput} value={s.username || ''} onChange={e => handleRegistryEdit(s.id, 'username', e.target.value.toUpperCase())} placeholder="Auto-Generated" /></td>
                      <td><input style={ghostInput} value={s.password || ''} onChange={e => handleRegistryEdit(s.id, 'password', e.target.value)} placeholder="1212" /></td>
                       <td style={{ minWidth: '200px', position: 'relative' }}>
                        {/* Selected role chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                          {(s.role || '').split(',').filter(Boolean).map(r => (
                            <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'rgba(0,242,255,0.12)', color: '#00F2FF', border: '1px solid rgba(0,242,255,0.25)' }}>
                              {r}
                              <button onClick={() => {
                                const updated = (s.role || '').split(',').filter(Boolean).filter(x => x !== r).join(',');
                                handleRegistryEdit(s.id, 'role', updated);
                              }} style={{ background: 'none', border: 'none', color: '#FF3131', cursor: 'pointer', fontSize: '10px', lineHeight: 1, padding: 0, fontWeight: 900 }}>×</button>
                            </span>
                          ))}
                        </div>
                        {/* Dropdown picker — darkSelect ensures text is visible on all OS themes */}
                        <select
                          style={{ ...darkSelect, fontSize: '9px' }}
                          value=""
                          onChange={e => {
                            if (!e.target.value) return;
                            const current = (s.role || '').split(',').filter(Boolean);
                            if (!current.includes(e.target.value)) {
                              handleRegistryEdit(s.id, 'role', [...current, e.target.value].join(','));
                            }
                          }}
                        >
                          <option value="">+ ADD ZONE / ROLE</option>
                          {[
                            { val: 'CDO',             label: 'CDO — ALL 31 ZONES' },
                            { val: 'GM',              label: 'GM — ALL 31 ZONES' },
                            { val: 'ADMIN',           label: 'ADMIN — Z-07, Z-19, Z-20, Z-11...' },
                            { val: 'STAFF',           label: 'STAFF — Operative (Z-07, Z-16, Z-17, Z-12, Z-30, Z-WEB, Z-PROP)' },
                            { val: 'HR',              label: 'HR (Z-09, Z-18, Z-2B)' },
                            { val: 'ACC',             label: 'Accounts (Z-11, Z-08, Z-1B)' },
                            { val: 'RECEPTION',       label: 'Reception (Z-05, Z-10)' },
                            { val: 'PHARMACY',        label: 'Pharmacy (Z-12)' },
                            { val: 'LAB',             label: 'Lab & Diagnostics (Z-14)' },
                            { val: 'DOCTOR',          label: 'Physician (Z-DOCTOR)' },
                            { val: 'NURSE',           label: 'Clinical Staff (Z-16)' },
                            { val: 'MN',              label: 'Maintenance (Z-12)' },
                            { val: 'SYNAPSE',         label: 'Synapse (Z-20)' },
                            { val: 'CAFETARIA',       label: 'Cafeteria (Z-29)' },
                            { val: 'PATIENT_GUIDE',   label: 'Patient Guide (Z-GUEST)' },
                            { val: 'WARD_ADMIN',      label: 'Ward Admin (Z-30)' },
                          ].filter(opt => !(s.role || '').split(',').includes(opt.val)).map(opt => (
                            <option key={opt.val} value={opt.val}>{opt.label}</option>
                          ))}
                        </select>
                       </td>
                      <td><input style={ghostInput} value={s.sal} type="number" onChange={e => handleRegistryEdit(s.id, 'sal', Number(e.target.value))} /></td>
                      <td><input style={ghostInput} value={s.commRate} type="number" onChange={e => handleRegistryEdit(s.id, 'commRate', Number(e.target.value))} /></td>
                      <td>
                        <select style={darkSelect} value={s.status} onChange={e => handleRegistryEdit(s.id, 'status', e.target.value as any)}>
                          <option>ON-DUTY</option><option>OFFLINE</option><option>TERMINATED</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <label style={{ cursor: 'pointer', fontSize: '16px' }} title="Update Avatar">
                            🖼️
                            <input type="file" accept="image/*" onChange={(e) => handleRegistryImageUpload(s.id, e)} style={{ display: 'none' }} />
                          </label>
                          <button style={{ color: '#FF3131', background: 'none', border: 'none', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }} onClick={async () => {
                            const confirmed = await showConfirm({
                              title: 'EVICT ASSET',
                              message: `Evict asset ${s.id}? This action is irreversible.`,
                              icon: '🗑️',
                              options: [
                                { label: 'DELETE ASSET', value: 'yes', variant: 'danger' },
                                { label: 'CANCEL', value: 'no', variant: 'cancel' }
                              ]
                            });
                            if (confirmed === 'yes') {
                              saveRegistry(staffRegistry.filter(st => st.id !== s.id));
                            }
                          }}>DELETE</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== VIEW: TALENT ENGINE (ENTERPRISE GRADE REDESIGN) ===== */}
        {activeTab === 'TALENT_ENGINE' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
              <div>
                <h2 style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>TALENT ENGINE</h2>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '8px', letterSpacing: '1px' }}>ENTERPRISE ASSET ACQUISITION & WORKFORCE ORCHESTRATION</div>
              </div>
              <button onClick={runAGIScan} disabled={isScanning} style={{ background: isScanning ? '#333' : 'rgba(0,242,255,0.05)', border: '1px solid #00F2FF', color: '#00F2FF', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, fontSize: '11px', cursor: isScanning ? 'wait' : 'pointer', letterSpacing: '1px', boxShadow: '0 0 15px rgba(0,242,255,0.1)' }}>
                {isScanning ? '⏳ SCANNING...' : '📡 SYNC AGI TALENT RADAR'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '30px' }}>
              {[
                { label: 'VACANCIES', val: vacancies.length, c: '#D4AF37' },
                { label: 'PENDING GM', val: vacancies.filter(v => v.status === 'PENDING_GM').length, c: '#FF8C00' },
                { label: 'PUBLISHED', val: vacancies.filter(v => v.status === 'PUBLISHED').length, c: '#39FF14' },
                { label: 'APPLICANTS', val: applications.length, c: '#00F2FF' },
                { label: 'REVIEW REQUIRED', val: applications.filter(a => a.status === 'NEW').length, c: '#FF3131' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${s.c}33`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ color: s.c, fontSize: '28px', fontWeight: 900 }}>{s.val}</div>
                  <div style={{ color: '#666', fontSize: '9px', fontWeight: 800, letterSpacing: '1px', marginTop: '8px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(8,8,18,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '30px', backdropFilter: 'blur(20px)' }}>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', flexWrap: 'wrap' }}>
                {[
                  { key: 'RADAR', label: '🧠 AGI SCANNER', color: '#FF8C00' },
                  { key: 'VACANCIES', label: '📋 VACANCY BOARD', color: '#D4AF37' },
                  { key: 'GM_QUEUE', label: '✅ GM APPROVAL', color: '#39FF14' },
                  { key: 'APPLICANTS', label: '👤 APPLICANTS', color: '#00F2FF' },
                ].map(t => (
                  <button key={t.key} onClick={() => setSteTab(t.key as any)}
                    style={{ background: steTab === t.key ? `${t.color}15` : 'transparent', color: steTab === t.key ? t.color : '#555', border: steTab === t.key ? `1px solid ${t.color}` : '1px solid transparent', padding: '11px 22px', borderRadius: '10px', fontWeight: 900, fontSize: '10px', cursor: 'pointer', letterSpacing: '1.5px', transition: '0.2s' }}>
                    {t.label}
                    {t.key === 'GM_QUEUE' && vacancies.filter(v => v.status === 'PENDING_GM').length > 0 && (
                      <span style={{ marginLeft: '6px', background: '#FF8C00', color: '#000', borderRadius: '50%', padding: '1px 5px', fontSize: '8px', fontWeight: 900 }}>{vacancies.filter(v => v.status === 'PENDING_GM').length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── RADAR PANEL ── */}
              {steTab === 'RADAR' && (
                <div>
                  <style>{`
                    @keyframes steRadarPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.6;transform:scale(0.97);}}
                    @keyframes steSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
                    @keyframes steCardIn{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
                    @keyframes steGlow{0%,100%{box-shadow:0 0 0 transparent;}50%{box-shadow:0 0 18px #FF8C0044;}}
                    .ste-dept-card{animation:steCardIn 0.5s ease both;transition:transform 0.25s,box-shadow 0.25s;border-radius:18px;}
                    .ste-dept-card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,0.7)!important;}
                  `}</style>
                  <div style={{ padding: '24px 30px', borderRadius: '20px', background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(255,140,0,0.12)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#FF8C00', fontWeight: 900, letterSpacing: '3px', marginBottom: '4px' }}>Z-09 · HUMAN CAPITAL INTELLIGENCE</div>
                      <h3 style={{ color: '#FFF', margin: 0, fontSize: '20px', fontFamily: 'Cinzel, serif', letterSpacing: '2px' }}>🧠 AGI DEPARTMENT RADAR</h3>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Headcount · workload · efficiency · SHRM-ILO gap detection · AI vacancy generation</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <button onClick={runAGIScan} disabled={isScanning}
                        style={{ background: isScanning ? 'rgba(255,140,0,0.08)' : 'linear-gradient(135deg,rgba(255,140,0,0.25),rgba(255,100,0,0.15))', border: '1px solid #FF8C00', color: '#FF8C00', padding: '14px 32px', borderRadius: '12px', fontWeight: 900, fontSize: '12px', cursor: isScanning ? 'wait' : 'pointer', letterSpacing: '2px', boxShadow: isScanning ? 'none' : '0 0 20px rgba(255,140,0,0.3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isScanning && <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #FF8C0033', borderTop: '2px solid #FF8C00', display: 'inline-block', animation: 'steSpin 0.8s linear infinite' }} />}
                        {isScanning ? 'SCANNING...' : '📡 SCAN ALL DEPARTMENTS'}
                      </button>
                      <div style={{ fontSize: '9px', color: '#444', letterSpacing: '1px' }}>{scanResults.length > 0 ? `✓ ${scanResults.length} DEPARTMENTS ANALYSED` : 'AWAITING SCAN COMMAND'}</div>
                    </div>
                  </div>
                  {scanResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 40px', border: '1px dashed rgba(255,140,0,0.15)', borderRadius: '20px', background: 'rgba(255,140,0,0.02)' }}>
                      <div style={{ fontSize: '60px', marginBottom: '20px', animation: 'steRadarPulse 3s ease infinite' }}>📡</div>
                      <div style={{ color: '#FF8C00', fontWeight: 900, fontSize: '14px', letterSpacing: '2px', marginBottom: '10px' }}>AGI RADAR STANDBY</div>
                      <div style={{ color: '#555', fontSize: '12px' }}>Click SCAN ALL DEPARTMENTS to run the AGI talent gap analysis.</div>
                      <div style={{ color: '#333', fontSize: '11px', marginTop: '8px' }}>Reads live employee data, open tickets, efficiency metrics & workload pressure.</div>
                    </div>
                  )}
                  {scanResults.length > 0 && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
                        {[
                          { label: 'CRITICAL ALERTS', val: scanResults.filter(r => r.urgency_level === 'CRITICAL').length, c: '#FF3131', icon: '🚨' },
                          { label: 'HIGH PRIORITY', val: scanResults.filter(r => r.urgency_level === 'HIGH').length, c: '#FF8C00', icon: '⚠️' },
                          { label: 'NEED HIRING', val: scanResults.filter(r => r.needs_hiring).length, c: '#D4AF37', icon: '🎯' },
                          { label: 'HEALTHY DEPTS', val: scanResults.filter(r => !r.needs_hiring).length, c: '#39FF14', icon: '✅' },
                        ].map((m, i) => (
                          <div key={i} style={{ padding: '20px 24px', borderRadius: '16px', background: `${m.c}08`, border: `1px solid ${m.c}33`, position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${m.c},transparent)` }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: '9px', color: '#555', letterSpacing: '2px', marginBottom: '8px' }}>{m.label}</div>
                                <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'monospace', color: m.c, textShadow: `0 0 20px ${m.c}55`, lineHeight: 1 }}>{m.val}</div>
                              </div>
                              <div style={{ fontSize: '28px', opacity: 0.3 }}>{m.icon}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {scanResults.map((dept, idx) => {
                          const uc = urgencyColor(dept.urgency_level);
                          return (
                            <div key={dept.department} className="ste-dept-card"
                              style={{ background: 'rgba(6,6,15,0.96)', border: `1px solid ${uc}22`, borderLeft: `4px solid ${uc}`, padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', animationDelay: `${idx * 0.05}s` }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', marginBottom: '18px' }}>
                                <div style={{ flexShrink: 0, width: '50px', height: '50px', borderRadius: '14px', background: `${uc}15`, border: `1px solid ${uc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ fontSize: '16px' }}>{dept.urgency_level === 'CRITICAL' ? '🚨' : dept.urgency_level === 'HIGH' ? '⚠️' : dept.urgency_level === 'MODERATE' ? '⚡' : '✅'}</div>
                                  <div style={{ fontSize: '8px', color: uc, fontWeight: 900 }}>{dept.urgency_score}</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#FFF', fontWeight: 900, fontSize: '15px', fontFamily: 'monospace', letterSpacing: '1px' }}>{dept.department}</span>
                                    {dept.zone && <span style={{ fontSize: '9px', color: '#555', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '6px' }}>{dept.zone}</span>}
                                    <span style={{ background: `${uc}22`, color: uc, border: `1px solid ${uc}55`, fontSize: '8px', fontWeight: 900, padding: '3px 10px', borderRadius: '8px', letterSpacing: '1.5px' }}>{dept.urgency_level}</span>
                                    {dept.needs_hiring && <span style={{ background: 'rgba(255,140,0,0.12)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.3)', fontSize: '8px', fontWeight: 900, padding: '3px 10px', borderRadius: '8px', animation: 'steGlow 2s ease infinite' }}>🎯 HIRING NEEDED</span>}
                                  </div>
                                  {dept.trigger_reasons.length > 0 && <div style={{ color: '#666', fontSize: '10px' }}>{dept.trigger_reasons.map((r, i) => <span key={i} style={{ marginRight: '14px' }}>▸ {r}</span>)}</div>}
                                </div>
                                {dept.needs_hiring ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '210px', flexShrink: 0 }}>
                                    <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder={`e.g. ${dept.department} Officer`}
                                      style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,140,0,0.3)', color: '#FFF', padding: '10px 14px', borderRadius: '10px', fontSize: '11px', outline: 'none' }} />
                                    <button onClick={() => { setSelectedDeptForVacancy(dept); generateJD(dept, roleTitle || dept.department + ' Officer'); }} disabled={isGeneratingJD}
                                      style={{ background: 'linear-gradient(135deg,rgba(255,140,0,0.2),rgba(255,60,0,0.1))', border: '1px solid #FF8C00', color: '#FF8C00', padding: '10px 16px', borderRadius: '10px', fontWeight: 900, fontSize: '10px', cursor: isGeneratingJD ? 'wait' : 'pointer', letterSpacing: '1px', boxShadow: '0 0 14px rgba(255,140,0,0.2)' }}>
                                      {isGeneratingJD ? '⏳ GENERATING JD...' : '🤖 GENERATE AGI VACANCY'}
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ padding: '12px 18px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '12px', textAlign: 'center', flexShrink: 0 }}>
                                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>✅</div>
                                    <div style={{ color: '#39FF14', fontWeight: 900, fontSize: '9px', letterSpacing: '1px' }}>FULLY STAFFED</div>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                                {[
                                  { label: 'HEADCOUNT', val: dept.headcount, unit: 'STAFF', color: '#00F2FF' },
                                  { label: 'OPEN TICKETS', val: dept.open_tickets, unit: 'TICKETS', color: dept.open_tickets > 5 ? '#FF3131' : '#D4AF37' },
                                  { label: 'WORKLOAD/PERSON', val: dept.workload_per_person.toFixed(1), unit: 'LOAD IDX', color: dept.workload_per_person > 5 ? '#FF3131' : dept.workload_per_person > 3 ? '#FF8C00' : '#39FF14' },
                                  { label: 'AVG EFFICIENCY', val: `${dept.avg_efficiency_pct}%`, unit: '', color: dept.avg_efficiency_pct < 70 ? '#FF3131' : dept.avg_efficiency_pct < 85 ? '#FF8C00' : '#39FF14', bar: true, barW: Math.min(dept.avg_efficiency_pct, 100) },
                                  { label: 'AVG SALARY', val: `AED ${(dept.avg_salary_aed || 0).toLocaleString()}`, unit: '/MO', color: '#9D50BB' },
                                ].map((m: any, i) => (
                                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '8px', color: '#444', letterSpacing: '1.5px', marginBottom: '5px' }}>{m.label}</div>
                                    <div style={{ fontSize: '17px', fontWeight: 900, fontFamily: 'monospace', color: m.color }}>{m.val}</div>
                                    {m.unit && <div style={{ fontSize: '8px', color: '#333', marginTop: '2px' }}>{m.unit}</div>}
                                    {m.bar && <div style={{ marginTop: '7px', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${m.barW}%`, height: '100%', background: m.color, borderRadius: '2px', boxShadow: `0 0 6px ${m.color}66`, transition: 'width 1s ease' }} /></div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── VACANCY BOARD ── */}
              {steTab === 'VACANCIES' && (
                <div>
                  <style>{`
                    @keyframes steVacIn{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
                    .ste-vac-card{animation:steVacIn 0.4s ease both;transition:transform 0.2s;border-radius:14px;}
                    .ste-vac-card:hover{transform:translateY(-3px);}
                  `}</style>
                  <div style={{ padding: '22px 28px', borderRadius: '18px', background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(212,175,55,0.12)', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 900, letterSpacing: '3px', marginBottom: '4px' }}>Z-09 · VACANCY PIPELINE</div>
                      <h3 style={{ color: '#FFF', margin: 0, fontSize: '19px', fontFamily: 'Cinzel, serif', letterSpacing: '2px' }}>📋 SOVEREIGN VACANCY BOARD</h3>
                    </div>
                    <button onClick={fetchSTEData} style={{ background: 'transparent', border: '1px solid #D4AF37', color: '#D4AF37', padding: '10px 18px', borderRadius: '10px', fontWeight: 900, fontSize: '10px', cursor: 'pointer', letterSpacing: '1px' }}>⟳ REFRESH</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                    {(['DRAFT', 'PENDING_GM', 'PUBLISHED', 'CLOSED'] as const).map(col => {
                      const colMeta: Record<string,{color:string;label:string;icon:string;bg:string}> = {
                        DRAFT:{color:'#888',label:'DRAFT',icon:'✏️',bg:'rgba(136,136,136,0.04)'},
                        PENDING_GM:{color:'#FF8C00',label:'PENDING GM',icon:'⏳',bg:'rgba(255,140,0,0.04)'},
                        PUBLISHED:{color:'#39FF14',label:'LIVE',icon:'🟢',bg:'rgba(57,255,20,0.03)'},
                        CLOSED:{color:'#FF3131',label:'CLOSED',icon:'🔴',bg:'rgba(255,49,49,0.03)'},
                      };
                      const meta = colMeta[col];
                      const colVacs = vacancies.filter(v => v.status === col);
                      return (
                        <div key={col} style={{ background: meta.bg, borderRadius: '18px', padding: '16px', border: `1px solid ${meta.color}22` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: `1px solid ${meta.color}22`, marginBottom: '12px' }}>
                            <div>
                              <div style={{ color: meta.color, fontWeight: 900, fontSize: '10px', letterSpacing: '1.5px' }}>{meta.icon} {meta.label}</div>
                              <div style={{ color: '#444', fontSize: '9px', marginTop: '2px' }}>{colVacs.length} POS.</div>
                            </div>
                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${meta.color}15`, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, fontSize: '13px', fontWeight: 900 }}>{colVacs.length}</div>
                          </div>
                          {colVacs.map((v, i) => (
                            <div key={v.id} className="ste-vac-card"
                              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', padding: '13px', marginBottom: '9px', position: 'relative', overflow: 'hidden', animationDelay: `${i*0.07}s` }}>
                              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg,transparent,${meta.color}66,transparent)` }} />
                              <div style={{ color: '#FFF', fontWeight: 700, fontSize: '11px', marginBottom: '3px', lineHeight: 1.3 }}>{v.title}</div>
                              <div style={{ color: '#666', fontSize: '9px', marginBottom: '7px' }}>{v.department}</div>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                {v.ai_generated && <span style={{ background: 'rgba(255,140,0,0.12)', color: '#FF8C00', fontSize: '7px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>🤖 AGI</span>}
                                {v.is_featured && <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', fontSize: '7px', padding: '2px 5px', borderRadius: '4px', fontWeight: 800 }}>⭐</span>}
                                <span style={{ background: 'rgba(255,255,255,0.05)', color: '#666', fontSize: '7px', padding: '2px 5px', borderRadius: '4px' }}>{v.positions_count}x</span>
                              </div>
                              <div style={{ color: '#D4AF37', fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, marginBottom: '5px' }}>AED {(v.salary_min||0).toLocaleString()} – {(v.salary_max||0).toLocaleString()}</div>
                              {v.applications_count > 0 && <div style={{ color: '#00F2FF', fontSize: '9px', marginBottom: '7px' }}>👤 {v.applications_count} applicant{v.applications_count !== 1 ? 's' : ''}</div>}
                              {v.ai_urgency_score > 0 && <div style={{ marginBottom: '8px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${v.ai_urgency_score}%`, height: '100%', background: v.ai_urgency_score > 70 ? '#FF3131' : '#FF8C00', borderRadius: '2px' }} /></div>}
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {col === 'DRAFT' && <button onClick={() => submitForApproval(v.id)} style={{ flex: 1, background: 'rgba(255,140,0,0.1)', border: '1px solid #FF8C00', color: '#FF8C00', padding: '6px 4px', borderRadius: '7px', fontWeight: 900, fontSize: '8px', cursor: 'pointer' }}>→ GM QUEUE</button>}
                                {col === 'PUBLISHED' && v.applications_count > 0 && <button onClick={() => setSteTab('APPLICANTS')} style={{ flex: 1, background: 'rgba(0,242,255,0.08)', border: '1px solid #00F2FF', color: '#00F2FF', padding: '6px 4px', borderRadius: '7px', fontWeight: 900, fontSize: '8px', cursor: 'pointer' }}>VIEW APPS</button>}
                                {col !== 'CLOSED' && <button onClick={() => { if (window.confirm('Close this vacancy?')) fetch(`${API}/hr/talent/vacancies/${v.id}/close`,{method:'POST'}).then(()=>fetchSTEData()); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#555', padding: '6px 7px', borderRadius: '7px', fontWeight: 900, fontSize: '8px', cursor: 'pointer' }}>CLOSE</button>}
                              </div>
                            </div>
                          ))}
                          {colVacs.length === 0 && <div style={{ color: '#222', fontSize: '11px', textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: '10px' }}><div style={{ fontSize: '20px', marginBottom: '6px', opacity: 0.25 }}>{meta.icon}</div>Empty</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── GM APPROVAL QUEUE ── */}
              {steTab === 'GM_QUEUE' && (
                <div>
                  <div style={{ padding: '22px 28px', borderRadius: '18px', background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(57,255,20,0.12)', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#39FF14', fontWeight: 900, letterSpacing: '3px', marginBottom: '4px' }}>Z-09 · GM REVIEW & PUBLISH CONTROL</div>
                      <h3 style={{ color: '#FFF', margin: 0, fontSize: '19px', fontFamily: 'Cinzel, serif', letterSpacing: '2px' }}>✅ GM APPROVAL QUEUE</h3>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Approve to publish live to the Public Careers Portal</div>
                    </div>
                    <div style={{ textAlign: 'right', padding: '12px 18px', background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '12px' }}>
                      <div style={{ fontSize: '9px', color: '#555', letterSpacing: '2px' }}>PENDING REVIEW</div>
                      <div style={{ fontSize: '30px', fontWeight: 900, fontFamily: 'monospace', color: '#39FF14', textShadow: '0 0 20px #39FF1466' }}>{vacancies.filter(v => v.status === 'PENDING_GM').length}</div>
                    </div>
                  </div>
                  {vacancies.filter(v => v.status === 'PENDING_GM').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '70px 40px', border: '1px dashed rgba(57,255,20,0.1)', borderRadius: '18px', background: 'rgba(57,255,20,0.02)' }}>
                      <div style={{ fontSize: '52px', marginBottom: '14px' }}>✅</div>
                      <div style={{ color: '#39FF14', fontWeight: 900, fontSize: '14px', letterSpacing: '2px', marginBottom: '6px' }}>QUEUE CLEAR</div>
                      <div style={{ color: '#555', fontSize: '12px' }}>No vacancies pending GM approval.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {vacancies.filter(v => v.status === 'PENDING_GM').map((v, i) => (
                        <div key={v.id} style={{ background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(255,140,0,0.25)', borderRadius: '18px', padding: '26px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg,transparent,#FF8C00,transparent)' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '18px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '7px', flexWrap: 'wrap' }}>
                                <h3 style={{ color: '#FFF', fontSize: '17px', margin: 0, fontFamily: 'Cinzel, serif' }}>{v.title}</h3>
                                {v.ai_generated && <span style={{ background: 'rgba(255,140,0,0.15)', color: '#FF8C00', border: '1px solid rgba(255,140,0,0.4)', fontSize: '9px', padding: '3px 10px', borderRadius: '8px', fontWeight: 900 }}>🤖 AGI GENERATED</span>}
                              </div>
                              <div style={{ color: '#888', fontSize: '12px', marginBottom: '4px' }}>{v.department} · {v.location} · {v.positions_count} position{v.positions_count !== 1 ? 's' : ''}</div>
                              <div style={{ color: '#D4AF37', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, marginBottom: '6px' }}>AED {(v.salary_min||0).toLocaleString()} – AED {(v.salary_max||0).toLocaleString()}/month</div>
                              {v.ai_urgency_score > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                  <div style={{ fontSize: '9px', color: '#555', letterSpacing: '1px' }}>AGI URGENCY</div>
                                  <div style={{ flex: 1, maxWidth: '180px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}><div style={{ width: `${v.ai_urgency_score}%`, height: '100%', background: v.ai_urgency_score > 70 ? '#FF3131' : '#FF8C00', borderRadius: '2px', boxShadow: `0 0 8px ${v.ai_urgency_score > 70 ? '#FF3131' : '#FF8C00'}` }} /></div>
                                  <div style={{ fontSize: '11px', fontWeight: 900, fontFamily: 'monospace', color: v.ai_urgency_score > 70 ? '#FF3131' : '#FF8C00' }}>{v.ai_urgency_score}/100</div>
                                </div>
                              )}
                              {v.ai_trigger_reason && <div style={{ color: '#555', fontSize: '10px', marginTop: '5px' }}>▸ Trigger: {v.ai_trigger_reason}</div>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                              <button onClick={() => gmAction(v.id, 'APPROVE')} style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid #39FF14', color: '#39FF14', padding: '12px 22px', borderRadius: '10px', fontWeight: 900, fontSize: '11px', cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap' }}>✅ APPROVE & PUBLISH</button>
                              <button onClick={() => { const n = prompt('Edit note:') || ''; gmAction(v.id, 'REQUEST_EDIT', n); }} style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid #D4AF37', color: '#D4AF37', padding: '10px 22px', borderRadius: '10px', fontWeight: 900, fontSize: '10px', cursor: 'pointer' }}>✏️ REQUEST EDIT</button>
                              <button onClick={() => { const n = prompt('Rejection reason:') || ''; gmAction(v.id, 'REJECT', n); }} style={{ background: 'rgba(255,49,49,0.06)', border: '1px solid rgba(255,49,49,0.4)', color: '#FF3131', padding: '8px 22px', borderRadius: '10px', fontWeight: 900, fontSize: '10px', cursor: 'pointer' }}>✗ REJECT</button>
                            </div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '13px 17px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '9px', color: '#555', fontWeight: 900, letterSpacing: '2px', marginBottom: '5px' }}>ROLE SUMMARY</div>
                            <div style={{ fontSize: '12px', color: '#ccc', lineHeight: '1.7' }}>{v.role_summary}</div>
                          </div>
                          {(v.responsibilities||[]).length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' }}>
                              {(v.responsibilities||[]).slice(0,6).map((r:any,i:number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '7px 11px', background: 'rgba(255,255,255,0.01)', borderRadius: '7px' }}>
                                  <span style={{ color: '#FF8C00', fontSize: '10px', flexShrink: 0, marginTop: '1px' }}>▸</span>
                                  <span style={{ color: '#aaa', fontSize: '10px', lineHeight: 1.5 }}>{r.text || r}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── APPLICANT POOL ── */}
              {steTab === 'APPLICANTS' && (
                <div>
                  <style>{`
                    @keyframes steAppIn{from{opacity:0;transform:translateX(-10px);}to{opacity:1;transform:translateX(0);}}
                    .ste-app-row{animation:steAppIn 0.3s ease both;transition:background 0.2s;}
                    .ste-app-row:hover{background:rgba(0,242,255,0.03)!important;}
                  `}</style>
                  <div style={{ padding: '22px 28px', borderRadius: '18px', background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(0,242,255,0.1)', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#00F2FF', fontWeight: 900, letterSpacing: '3px', marginBottom: '4px' }}>Z-09 · APPLICANT INTELLIGENCE CENTRE</div>
                      <h3 style={{ color: '#FFF', margin: 0, fontSize: '19px', fontFamily: 'Cinzel, serif', letterSpacing: '2px' }}>👤 APPLICANT TRACKER</h3>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>Full pipeline · Status management · One-click onboarding handoff</div>
                    </div>
                    <div style={{ textAlign: 'right', padding: '12px 18px', background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '12px' }}>
                      <div style={{ fontSize: '9px', color: '#555', letterSpacing: '2px' }}>TOTAL APPLICANTS</div>
                      <div style={{ fontSize: '30px', fontWeight: 900, fontFamily: 'monospace', color: '#00F2FF', textShadow: '0 0 20px #00F2FF66' }}>{applications.length}</div>
                    </div>
                  </div>
                  {applications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '70px 40px', border: '1px dashed rgba(0,242,255,0.1)', borderRadius: '18px', background: 'rgba(0,242,255,0.01)' }}>
                      <div style={{ fontSize: '52px', marginBottom: '14px' }}>📬</div>
                      <div style={{ color: '#00F2FF', fontWeight: 900, fontSize: '14px', letterSpacing: '2px', marginBottom: '7px' }}>NO APPLICATIONS YET</div>
                      <div style={{ color: '#555', fontSize: '12px' }}>Publish vacancies to receive candidates from the Careers Portal.</div>
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(6,6,15,0.97)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr', padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {['APPLICANT','VACANCY','SOURCE','APPLIED','STATUS','ACTIONS'].map(h => (
                          <div key={h} style={{ fontSize: '8px', color: '#444', fontWeight: 900, letterSpacing: '2px' }}>{h}</div>
                        ))}
                      </div>
                      {applications.map((app, i) => (
                        <div key={app.id} className="ste-app-row"
                          style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1.5fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)', animationDelay: `${i*0.04}s` }}>
                          <div>
                            <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px' }}>{app.applicant_name}</div>
                            <div style={{ color: '#555', fontSize: '10px', marginTop: '2px' }}>{app.applicant_email}</div>
                            {app.applicant_nationality && <div style={{ color: '#444', fontSize: '9px', marginTop: '2px' }}>{app.applicant_nationality} · {app.current_location}</div>}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 700 }}>{app.vacancy_title}</div>
                            <div style={{ color: '#555', fontSize: '9px' }}>{app.vacancy_department}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ background: app.source === 'LINKEDIN' ? 'rgba(0,119,181,0.2)' : app.source === 'INDEED' ? 'rgba(42,100,150,0.2)' : 'rgba(0,242,255,0.1)', color: app.source === 'LINKEDIN' ? '#0077B5' : app.source === 'INDEED' ? '#2357A5' : '#00F2FF', border: '1px solid currentColor', fontSize: '8px', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>{app.source}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', color: '#555', fontSize: '10px' }}>{app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}</div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <select value={app.status} onChange={e => updateAppStatus(app.id, e.target.value)}
                              style={{ background: '#111', border: `1px solid ${app.status==='HIRED'?'#39FF14':app.status==='REJECTED'?'#FF3131':app.status==='SHORTLISTED'?'#D4AF37':'rgba(255,255,255,0.12)'}`, color: app.status==='HIRED'?'#39FF14':app.status==='REJECTED'?'#FF3131':app.status==='SHORTLISTED'?'#D4AF37':'#FFF', fontSize: '9px', padding: '5px 8px', borderRadius: '6px', cursor: 'pointer', outline: 'none', fontWeight: 900 }}>
                              {['NEW','REVIEWING','SHORTLISTED','INTERVIEWED','OFFER_SENT','HIRED','REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {app.cv_url && <a href={`${API.replace('/api','')}${app.cv_url}`} target="_blank" rel="noreferrer" style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid #D4AF37', color: '#D4AF37', padding: '5px 9px', borderRadius: '6px', fontWeight: 900, fontSize: '8px', textDecoration: 'none' }}>📄 CV</a>}
                            {app.linkedin_profile && <a href={app.linkedin_profile} target="_blank" rel="noreferrer" style={{ background: 'rgba(0,119,181,0.15)', border: '1px solid #0077B5', color: '#0077B5', padding: '5px 7px', borderRadius: '6px', fontWeight: 900, fontSize: '8px', textDecoration: 'none' }}>in</a>}
                            <button onClick={() => moveToOnboarding(app)} style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid #39FF14', color: '#39FF14', padding: '5px 7px', borderRadius: '6px', fontWeight: 900, fontSize: '8px', cursor: 'pointer' }}>→ ONBOARD</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>{/* end main content panel */}
          </div>
        )}{/* end TALENT_ENGINE */}

        {/* COMPLIANCE TAB */}
        {activeTab === 'COMPLIANCE' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ color: '#FF8C00', fontFamily: 'Cinzel', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>⚖️ SOVEREIGN COMPLIANCE ENGINE</h2>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '8px', letterSpacing: '1px' }}>UAE LABOUR LAW (FEDERAL DECREE-LAW NO. 33 OF 2021) DOCUMENT AUDITING</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
              {/* Left Column: Register Doc & Gratuity Calculator */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Employee Selector dossier */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <label style={labelStyle}>SELECT OPERATIVE DOSSIER</label>
                  <select
                    style={darkSelect}
                    value={selectedCompEmployeeId}
                    onChange={e => {
                      setSelectedCompEmployeeId(e.target.value);
                      if (e.target.value) {
                        fetchSelectedEmployeeDocs(e.target.value);
                        calculateGratuity(e.target.value);
                      } else {
                        setSelectedEmpDocs([]);
                        setGratuityCalc(null);
                      }
                    }}
                  >
                    <option value="">-- SELECT STAFF --</option>
                    {staffRegistry.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} {emp.lastName} ({emp.id})</option>
                    ))}
                  </select>

                  {selectedCompEmployeeId && (
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                        <div style={{ color: '#888', fontSize: '9px', fontWeight: 900, marginBottom: '5px' }}>DOCUMENTS REGISTERED</div>
                        <div style={{ color: '#FF8C00', fontSize: '22px', fontWeight: 900 }}>{selectedEmpDocs.length}</div>
                      </div>
                      
                      {/* UAE Gratuity Panel */}
                      {gratuityCalc && gratuityCalc.status === 'SUCCESS' && (
                        <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)', padding: '15px', borderRadius: '12px' }}>
                          <div style={{ color: '#D4AF37', fontSize: '10px', fontWeight: 900, letterSpacing: '1px', marginBottom: '8px' }}>UAE GRATUITY ENTITLEMENT</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                            <span style={{ color: '#888' }}>Service Duration:</span>
                            <span style={{ color: '#FFF', fontWeight: 900 }}>{gratuityCalc.service_years} Years</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                            <span style={{ color: '#888' }}>Daily Wage:</span>
                            <span style={{ color: '#FFF' }}>{formatMoney(gratuityCalc.daily_wage)} / Day</span>
                          </div>
                          <div style={{ borderTop: '1px dashed rgba(212,175,55,0.2)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#00FF88', fontSize: '11px', fontWeight: 900 }}>GRATUITY:</span>
                            <b style={{ color: '#00FF88', fontSize: '16px' }}>{formatMoney(gratuityCalc.gratuity_entitlement)}</b>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Document Registration Form */}
                {selectedCompEmployeeId && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                    <div style={{ color: '#FF8C00', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '15px' }}>REGISTER NEW COMPLIANCE DOCUMENT</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div>
                        <label style={labelStyle}>DOCUMENT TYPE</label>
                        <select style={darkSelect} value={compFormData.doc_type} onChange={e => setCompFormData({...compFormData, doc_type: e.target.value})}>
                          {['VISA', 'EMIRATES_ID', 'PASSPORT', 'HEALTH_CARD', 'WORK_PERMIT', 'LABOUR_CONTRACT', 'INSURANCE_CARD', 'DRIVING_LICENSE'].map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>DOCUMENT NUMBER</label>
                        <input style={inputStyle} value={compFormData.doc_number} onChange={e => setCompFormData({...compFormData, doc_number: e.target.value})} placeholder="e.g. 784-1990-XXXXXXX-X" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={labelStyle}>ISSUE DATE</label>
                          <input type="date" style={inputStyle} value={compFormData.issue_date} onChange={e => setCompFormData({...compFormData, issue_date: e.target.value})} />
                        </div>
                        <div>
                          <label style={labelStyle}>EXPIRY DATE</label>
                          <input type="date" style={inputStyle} value={compFormData.expiry_date} onChange={e => setCompFormData({...compFormData, expiry_date: e.target.value})} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>ISSUING AUTHORITY</label>
                        <input style={inputStyle} value={compFormData.issuing_authority} onChange={e => setCompFormData({...compFormData, issuing_authority: e.target.value})} />
                      </div>
                      <div>
                        <label style={labelStyle}>COMPLIANCE NOTES</label>
                        <input style={inputStyle} value={compFormData.notes} onChange={e => setCompFormData({...compFormData, notes: e.target.value})} placeholder="Verification comments..." />
                      </div>
                      
                      <button onClick={() => registerDocument(selectedCompEmployeeId)} style={actionBtn('#FF8C00', '11px', '12px')}>
                        💾 COMMIT DOCUMENT TO VAULT
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Global Expiry Alerts & Selected Employee Docs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Global Expiry Alerts Board */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#FF8C00', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>GLOBAL EXPIRY ALERTS (EXPIRING IN 60 DAYS)</div>
                  
                  {isCompLoading ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>SCANNING COMPLIANCE ENGINE...</div>
                  ) : complianceAlerts.length === 0 ? (
                    <div style={{ color: '#39FF14', textAlign: 'center', padding: '20px', background: 'rgba(57,255,20,0.02)', border: '1px solid rgba(57,255,20,0.1)', borderRadius: '10px' }}>✅ ALL STAFF DOCUMENTS SECURED (NO ACTIVE ALERTS)</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {complianceAlerts.map((alert, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid ${alert.alert_status === 'EXPIRED' || alert.alert_status === 'CRITICAL' ? '#FF3131' : '#FF8C00'}`, padding: '15px', borderRadius: '8px' }}>
                          <div>
                            <b style={{ color: '#FFF', fontSize: '13px' }}>{alert.employee_name}</b> <span style={{ color: '#666', fontSize: '10px' }}>({alert.dept})</span>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '4px' }}>{alert.doc_type} • No: {alert.doc_number || '—'}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: 900, color: alert.alert_status === 'EXPIRED' ? '#FF3131' : alert.alert_status === 'CRITICAL' ? '#FF8C00' : '#D4AF37' }}>
                              {alert.alert_status === 'EXPIRED' ? 'EXPIRED' : `${alert.days_remaining} DAYS REMAINING`}
                            </div>
                            <span style={{ fontSize: '9px', color: '#666' }}>Expiry: {alert.expiry_date ? alert.expiry_date.split('T')[0] : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Employee Documents Dossier */}
                {selectedCompEmployeeId && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                    <div style={{ color: '#FFF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>STAFF DOSSIER RECORDS</div>
                    
                    {selectedEmpDocs.length === 0 ? (
                      <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No documents registered for this operative.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={tableStyle}>
                          <thead>
                            <tr style={headerRow}>
                              <th>DOC TYPE</th>
                              <th>NUMBER</th>
                              <th>EXPIRY DATE</th>
                              <th>DAYS LEFT</th>
                              <th>STATUS</th>
                              <th>ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedEmpDocs.map(doc => (
                              <tr key={doc.id} style={dataRow}>
                                <td style={{ padding: '15px' }}><b style={{ color: '#FFF' }}>{doc.doc_type}</b></td>
                                <td>{doc.doc_number || '—'}</td>
                                <td>{doc.expiry_date ? doc.expiry_date.split('T')[0] : '—'}</td>
                                <td>{doc.days_remaining !== null ? `${doc.days_remaining} days` : '—'}</td>
                                <td>
                                  <span style={{
                                    fontSize: '9px', padding: '3px 8px', borderRadius: '10px', fontWeight: 900,
                                    background: doc.alert_status === 'OK' ? 'rgba(57,255,20,0.12)' : 'rgba(255,140,0,0.12)',
                                    color: doc.alert_status === 'OK' ? '#39FF14' : '#FF8C00',
                                    border: `1px solid ${doc.alert_status === 'OK' ? '#39FF14' : '#FF8C00'}`
                                  }}>{doc.alert_status}</span>
                                </td>
                                <td>
                                  <button style={{ color: '#FF3131', background: 'none', border: 'none', fontSize: '10px', fontWeight: 900, cursor: 'pointer' }}
                                    onClick={async () => {
                                      const confirmed = await showConfirm({
                                        title: 'PURGE DOCUMENT', message: 'Purge document record? Action is irreversible.', icon: '🗑️',
                                        options: [{ label: 'PURGE', value: 'yes', variant: 'danger' }, { label: 'CANCEL', value: 'no', variant: 'cancel' }]
                                      });
                                      if (confirmed === 'yes') {
                                        const r = await fetch(`${API}/hr/compliance/documents/${doc.id}`, { method: 'DELETE' });
                                        if (r.ok) {
                                          showToast('Document Purged', 'success', 'Compliance record purged.');
                                          fetchSelectedEmployeeDocs(selectedCompEmployeeId);
                                          fetchComplianceData();
                                        }
                                      }
                                    }}
                                  >PURGE</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LEAVE TAB */}
        {activeTab === 'LEAVE' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ color: '#00F2FF', fontFamily: 'Cinzel', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>📅 SOVEREIGN LEAVE KERNEL</h2>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '8px', letterSpacing: '1px' }}>UAE LABOUR LAW COMPLIANT WORKFORCE LEAVE MANAGEMENT & SYNAPSE WORKFLOWS</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
              {/* Left Column: Leave Requests List & Balances Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Active Leave Requests Table */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#00F2FF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>PENDING LEAVE REQUESTS</div>
                  
                  {isLeaveLoading ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>LOADING LEAVE LOGS...</div>
                  ) : leaveRequests.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No leave requests on record.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr style={headerRow}>
                            <th>OPERATIVE</th>
                            <th>TYPE</th>
                            <th>DATES</th>
                            <th>DAYS</th>
                            <th>REASON</th>
                            <th>STATUS</th>
                            <th>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveRequests.map(req => (
                            <tr key={req.id} style={dataRow}>
                              <td style={{ padding: '15px' }}>
                                <b style={{ color: '#FFF' }}>{req.employee_name}</b><br/>
                                <span style={{ color: '#666', fontSize: '9px' }}>{req.dept}</span>
                              </td>
                              <td><span style={{ fontSize: '10px', fontWeight: 900, color: '#00F2FF' }}>{req.leave_type}</span></td>
                              <td>
                                <span style={{ fontSize: '11px' }}>{req.start_date ? req.start_date.split('T')[0] : '—'} to {req.end_date ? req.end_date.split('T')[0] : '—'}</span>
                              </td>
                              <td style={{ fontWeight: 900 }}>{req.days_requested}</td>
                              <td style={{ fontSize: '11px', color: '#aaa' }}>{req.reason || '—'}</td>
                              <td>
                                <span style={{
                                  fontSize: '9px', padding: '3px 8px', borderRadius: '10px', fontWeight: 900,
                                  background: req.status === 'APPROVED' ? 'rgba(57,255,20,0.12)' : req.status === 'REJECTED' ? 'rgba(255,49,49,0.12)' : 'rgba(212,175,55,0.12)',
                                  color: req.status === 'APPROVED' ? '#39FF14' : req.status === 'REJECTED' ? '#FF3131' : '#D4AF37',
                                  border: `1px solid ${req.status === 'APPROVED' ? '#39FF14' : req.status === 'REJECTED' ? '#FF3131' : '#D4AF37'}`
                                }}>{req.status}</span>
                              </td>
                              <td>
                                {req.status === 'PENDING' ? (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleLeaveAction(req.id, 'approve')} style={{ background: '#39FF14', color: '#000', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900, cursor: 'pointer' }}>APPROVE</button>
                                    <button onClick={async () => {
                                      const reason = prompt("Enter rejection reason:");
                                      if (reason !== null) handleLeaveAction(req.id, 'reject', reason);
                                    }} style={{ background: '#FF3131', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 900, cursor: 'pointer' }}>REJECT</button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#666' }}>Resolved</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Leave Balance Grid */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#00F2FF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>STAFF ANNUAL LEAVE BALANCES</div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={headerRow}>
                          <th>STAFF</th>
                          <th>DEPARTMENT</th>
                          <th>ANNUAL ENTITLEMENT</th>
                          <th>USED</th>
                          <th>REMAINING</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveBalances.map(bal => (
                          <tr key={bal.employee_id} style={dataRow}>
                            <td style={{ padding: '15px' }}><b style={{ color: '#FFF' }}>{bal.employee_name}</b></td>
                            <td>{bal.dept}</td>
                            <td>{bal.annual_entitlement} Days</td>
                            <td>{bal.annual_used} Days</td>
                            <td style={{ fontWeight: 900, color: bal.annual_remaining < 5 ? '#FF3131' : '#00F2FF' }}>{bal.annual_remaining} Days</td>
                            <td>
                              <span style={{
                                fontSize: '9px', padding: '3px 8px', borderRadius: '10px', fontWeight: 900,
                                background: bal.risk_flag ? 'rgba(255,49,49,0.12)' : 'rgba(57,255,20,0.12)',
                                color: bal.risk_flag ? '#FF3131' : '#39FF14',
                                border: `1px solid ${bal.risk_flag ? '#FF3131' : '#39FF14'}`
                              }}>{bal.risk_flag ? 'LOW BALANCE' : 'SECURED'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Submit Leave Form */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                <div style={{ color: '#00F2FF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>SUBMIT LEAVE REQUEST</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <label style={labelStyle}>SELECT OPERATIVE</label>
                    <select style={darkSelect} value={leaveFormData.employee_id} onChange={e => setLeaveFormData({...leaveFormData, employee_id: e.target.value})}>
                      <option value="">-- SELECT STAFF --</option>
                      {staffRegistry.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} {emp.lastName} ({emp.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>LEAVE TYPE</label>
                    <select style={darkSelect} value={leaveFormData.leave_type} onChange={e => setLeaveFormData({...leaveFormData, leave_type: e.target.value})}>
                      {['ANNUAL', 'SICK', 'EMERGENCY', 'HAJJ', 'MATERNITY', 'PATERNITY', 'UNPAID', 'STUDY'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>START DATE</label>
                    <input type="date" style={inputStyle} value={leaveFormData.start_date} onChange={e => setLeaveFormData({...leaveFormData, start_date: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>END DATE</label>
                    <input type="date" style={inputStyle} value={leaveFormData.end_date} onChange={e => setLeaveFormData({...leaveFormData, end_date: e.target.value})} />
                  </div>
                  <div>
                    <label style={labelStyle}>REASON FOR LEAVE</label>
                    <input style={inputStyle} value={leaveFormData.reason} onChange={e => setLeaveFormData({...leaveFormData, reason: e.target.value})} placeholder="Vacation / Medical leave..." />
                  </div>
                  <div>
                    <label style={labelStyle}>COVER WORK PLAN</label>
                    <input style={inputStyle} value={leaveFormData.cover_plan} onChange={e => setLeaveFormData({...leaveFormData, cover_plan: e.target.value})} placeholder="Who covers during your absence..." />
                  </div>

                  <button onClick={submitLeaveRequest} style={actionBtn('#00F2FF', '11px', '12px')}>
                    🚀 DISPATCH LEAVE APPLICATION
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TRAINING TAB */}
        {activeTab === 'TRAINING' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ color: '#39FF14', fontFamily: 'Cinzel', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>🎓 SOVEREIGN TRAINING HUB</h2>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '8px', letterSpacing: '1px' }}>CERTIFICATION MANAGEMENT & SYNAPSE DIRECTIVE SYNCHRONIZATION</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
              {/* Left Column: Create Course & Enroll Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Course Creation Form */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#39FF14', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '15px' }}>REGISTER TRAINING PROGRAM</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={labelStyle}>COURSE NAME</label>
                      <input style={inputStyle} value={trainingFormData.name} onChange={e => setTrainingFormData({...trainingFormData, name: e.target.value})} placeholder="e.g. Fire Safety Certification" />
                    </div>
                    <div>
                      <label style={labelStyle}>CATEGORY</label>
                      <select style={darkSelect} value={trainingFormData.category} onChange={e => setTrainingFormData({...trainingFormData, category: e.target.value})}>
                        {['HACCP', 'FIRE_SAFETY', 'FIRST_AID', 'FOOD_HYGIENE', 'HOSPITALITY', 'IT_SECURITY', 'CUSTOM'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>EXPIRY DURATION (MONTHS)</label>
                      <input type="number" style={inputStyle} value={trainingFormData.expiry_months} onChange={e => setTrainingFormData({...trainingFormData, expiry_months: Number(e.target.value)})} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" checked={trainingFormData.is_mandatory} onChange={e => setTrainingFormData({...trainingFormData, is_mandatory: e.target.checked})} id="is_mandatory_chk" style={{ cursor: 'pointer' }} />
                      <label htmlFor="is_mandatory_chk" style={{ color: '#FFF', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}>MANDATORY PROGRAM</label>
                    </div>
                    <div>
                      <label style={labelStyle}>DESCRIPTION</label>
                      <input style={inputStyle} value={trainingFormData.description} onChange={e => setTrainingFormData({...trainingFormData, description: e.target.value})} />
                    </div>

                    <button onClick={createTrainingProgram} style={actionBtn('#39FF14', '11px', '12px')}>
                      💾 REGISTER COURSE
                    </button>
                  </div>
                </div>

                {/* Operative Enrollment Form */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#39FF14', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '15px' }}>BATCH ENROLL OPERATIVES</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                      <label style={labelStyle}>SELECT COURSE</label>
                      <select style={darkSelect} value={selectedProgForEnroll} onChange={e => setSelectedProgForEnroll(e.target.value ? Number(e.target.value) : '')}>
                        <option value="">-- SELECT PROGRAM --</option>
                        {trainingPrograms.map(prog => (
                          <option key={prog.id} value={prog.id}>{prog.name} ({prog.category})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>SELECT STAFF TO ENROLL</label>
                      <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {staffRegistry.map(emp => (
                          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                            <input
                              type="checkbox"
                              checked={selectedStaffForEnroll.includes(emp.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedStaffForEnroll([...selectedStaffForEnroll, emp.id]);
                                } else {
                                  setSelectedStaffForEnroll(selectedStaffForEnroll.filter(id => id !== emp.id));
                                }
                              }}
                              id={`enroll_${emp.id}`}
                            />
                            <label htmlFor={`enroll_${emp.id}`} style={{ color: '#FFF', fontSize: '11px', cursor: 'pointer' }}>{emp.name} {emp.lastName} ({emp.dept})</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button onClick={enrollEmployees} style={actionBtn('#39FF14', '11px', '12px')}>
                      🎓 DEPLOY KANBAN DIRECTIVE
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Expiring Certs Alerts & Current Programs List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Expiring Certifications Alerts */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#FF3131', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>⚠️ CRITICAL TRAINING ALERTS (MANDATORY COURSES)</div>
                  
                  {trainingAlerts.length === 0 ? (
                    <div style={{ color: '#39FF14', textAlign: 'center', padding: '20px', background: 'rgba(57,255,20,0.02)', border: '1px solid rgba(57,255,20,0.1)', borderRadius: '10px' }}>✅ ALL MANDATORY CERTIFICATIONS SECURED & UP-TO-DATE</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {trainingAlerts.map((alert, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderLeft: '4px solid #FF3131', padding: '15px', borderRadius: '8px' }}>
                          <div>
                            <b style={{ color: '#FFF', fontSize: '13px' }}>{alert.employee_name}</b> <span style={{ color: '#666', fontSize: '10px' }}>({alert.dept})</span>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '4px' }}>Program: {alert.program_name}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: '#FF3131' }}>{alert.status}</div>
                            <span style={{ fontSize: '9px', color: '#666' }}>Expiry: {alert.cert_expiry_date ? alert.cert_expiry_date.split('T')[0] : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Courses list */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                  <div style={{ color: '#FFF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>ACTIVE REGISTERED TRAINING PROGRAMS</div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                      <thead>
                        <tr style={headerRow}>
                          <th>COURSE NAME</th>
                          <th>CATEGORY</th>
                          <th>VALIDITY</th>
                          <th>TYPE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingPrograms.map(prog => (
                          <tr key={prog.id} style={dataRow}>
                            <td style={{ padding: '15px' }}><b style={{ color: '#FFF' }}>{prog.name}</b></td>
                            <td><span style={{ fontSize: '10px', color: '#39FF14', fontWeight: 900 }}>{prog.category}</span></td>
                            <td>{prog.expiry_months} Months</td>
                            <td>
                              <span style={{
                                fontSize: '9px', padding: '2px 6px', borderRadius: '8px',
                                background: prog.is_mandatory ? 'rgba(255,49,49,0.12)' : 'rgba(255,255,255,0.05)',
                                color: prog.is_mandatory ? '#FF3131' : '#aaa',
                                border: `1px solid ${prog.is_mandatory ? '#FF3131' : 'rgba(255,255,255,0.1)'}`
                              }}>{prog.is_mandatory ? 'MANDATORY' : 'OPTIONAL'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKFORCE INTEL TAB */}
        {activeTab === 'WORKFORCE_INTEL' && (
          <div style={{ animation: 'fadeIn 0.5s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h2 style={{ color: '#D4AF37', fontFamily: 'Cinzel', fontSize: '28px', margin: 0, textTransform: 'uppercase', letterSpacing: '4px' }}>📊 WORKFORCE INTEL HUB</h2>
                <div style={{ color: '#666', fontSize: '11px', marginTop: '8px', letterSpacing: '1px' }}>AGI PREDICTIVE ANALYSIS & OPERATIVE ROI PERFORMANCE HEATMAP</div>
              </div>
            </div>

            {/* AGI Telemetry Heatmap Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
              {/* ROI Heatmap Card */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                <div style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>OPERATIVE ROI PERFORMANCE HEATMAP</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {staffRegistry.map(emp => {
                    const sal = Number(emp.sal || 0);
                    const rev = Number(emp.revImpact || 0);
                    const commRate = Number(emp.commRate || 0);
                    const bonus = rev * (commRate / 100);
                    const totalPay = sal + bonus;
                    const roiScore = sal > 0 ? (rev / sal) : 0;
                    
                    let heatmapColor = '#39FF14'; // Green (high ROI)
                    if (roiScore < 2) heatmapColor = '#FF3131'; // Red (low ROI)
                    else if (roiScore < 5) heatmapColor = '#FF8C00'; // Orange
                    else if (roiScore < 10) heatmapColor = '#D4AF37'; // Gold
                    
                    return (
                      <div key={emp.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <b style={{ color: '#FFF' }}>{emp.name} {emp.lastName}</b>
                          <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>Position: {emp.pos} • Dept: {emp.dept}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: heatmapColor, fontWeight: 900, fontSize: '16px' }}>{roiScore.toFixed(1)}x ROI</div>
                          <span style={{ fontSize: '10px', color: '#888' }}>Pay: {formatMoney(totalPay)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AGI Prescriptions Card */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '25px', borderRadius: '16px' }}>
                <div style={{ color: '#00F2FF', fontSize: '12px', fontWeight: 900, letterSpacing: '1px', marginBottom: '20px' }}>🤖 AGI PREDICTIVE PRESCRIPTIONS</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: 'rgba(255,49,49,0.05)', border: '1px solid rgba(255,49,49,0.2)', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                      <b style={{ color: '#FF3131', fontSize: '13px' }}>DEPARTMENT WORKLOAD CRITICAL</b>
                      <p style={{ color: '#aaa', fontSize: '11px', margin: '5px 0 0 0', lineHeight: '1.5' }}>
                        Front Desk & Reservations department is currently operating at 180% task density. Headcount must expand to prevent burn-out of operative assets.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px' }}>💡</span>
                    <div>
                      <b style={{ color: '#D4AF37', fontSize: '13px' }}>ROI SURGE ALERT</b>
                      <p style={{ color: '#aaa', fontSize: '11px', margin: '5px 0 0 0', lineHeight: '1.5' }}>
                        Operatives in F&B generated an average ROI of 14.5x this month. Commission structures should be optimized to incentivize further upsells.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.2)', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '24px' }}>🛡️</span>
                    <div>
                      <b style={{ color: '#39FF14', fontSize: '13px' }}>SOVEREIGN TRAINING RECOMMENDATION</b>
                      <p style={{ color: '#aaa', fontSize: '11px', margin: '5px 0 0 0', lineHeight: '1.5' }}>
                        Tourism season surge starts in 45 days. AGI recommends enrolling all Front Desk operatives in Fire Safety & HACCP certification within 14 days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>{/* end contentBox */}

      {/* 🚀 ASSET DOSSIER OVERLAY (ROTHCHILD FINANCIAL & PERFORMANCE REVEAL) */}
      {selectedStaff && (
        <div style={overlay}>
          <div style={dossierCard}>
            <button onClick={() => setSelectedStaff(null)} style={closeBtn}>×</button>
            <div style={{ display: 'flex', gap: '40px' }}>
              
              {/* LEFT COLUMN: BIOMETRICS & IDENTITY */}
              <div style={{display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', width: '200px'}}>
                <div style={dossierAvatar}>
                   {selectedStaff.img ? (
                     <img 
                       src={selectedStaff.img.startsWith('blob:') ? selectedStaff.img : `${process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '/api'}${selectedStaff.img}`} 
                       style={{width:'100%', height:'100%', borderRadius:'24px', objectFit:'cover'}} 
                       alt={selectedStaff.name}
                     />
                   ) : '👤'}
                </div>
                <label style={{...actionBtn('#00F2FF', '9px', '10px'), textAlign: 'center', margin: 0, width: '100%', cursor: 'pointer', position: 'relative'}}>
                  <input type="file" accept="image/*" onChange={handleUpdateDossierImage} style={{position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, cursor: 'pointer'}} />
                  UPDATE UI AVATAR
                </label>
                <div style={{textAlign: 'center', marginTop: '10px'}}>
                   <div style={{color: '#888', fontSize: '9px', fontWeight: 900, letterSpacing: '1px'}}>SYSTEM STATUS</div>
                   <div style={{color: selectedStaff.status === 'ON-DUTY' ? '#39FF14' : '#FF3131', fontWeight: 900, fontSize: '14px', marginTop: '5px'}}>{selectedStaff.status}</div>
                </div>
              </div>

              {/* RIGHT COLUMN: ROTH LOGIC */}
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: 'Cinzel', color: '#00F2FF', fontSize: '32px', margin: 0 }}>{selectedStaff.name} {selectedStaff.lastName}</h2>
                <p style={{ color: '#D4AF37', fontWeight: 900, letterSpacing: '2px' }}>{selectedStaff.pos} | ID: {selectedStaff.id} | DEPT: {selectedStaff.dept}</p>
                
                <div style={metricGrid}>
                   <div style={metricItem}><span style={{color: '#888', fontSize: '9px', fontWeight: 900}}>MONTHLY HOURS</span><b style={{fontSize: '20px'}}>{selectedStaff.hours_month}</b></div>
                   <div style={metricItem}><span style={{color: '#888', fontSize: '9px', fontWeight: 900}}>EFFICIENCY RATING</span><b style={{color:'#39FF14', fontSize: '20px'}}>{selectedStaff.efficiency}%</b></div>
                   <div style={metricItem}><span style={{color: '#888', fontSize: '9px', fontWeight: 900}}>JOINING DATE</span><b style={{fontSize: '16px'}}>{selectedStaff.joined}</b></div>
                   <div style={metricItem}><span style={{color: '#888', fontSize: '9px', fontWeight: 900}}>ROI FACTOR</span><b style={{fontSize: '20px', color: '#00F2FF'}}>{selectedStaff.roi_score || '0x Factor'}</b></div>
                </div>

                <div style={financialStructureBox}>
                  <div style={{ color: '#D4AF37', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>FINANCIAL AGREEMENT STRUCTURE</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#888', fontSize: '12px' }}>Contractual Base Salary</span>
                    <span style={{ color: '#FFF', fontWeight: 900 }}>{formatMoney(selectedStaff.sal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#888', fontSize: '12px' }}>Commission Rate / Revenue Gen</span>
                    <span style={{ color: '#FFF', fontWeight: 900 }}>{selectedStaff.commRate}% ({formatMoney(selectedStaff.revImpact)})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', borderTop: '1px dashed #333', paddingTop: '15px' }}>
                    <span style={{ color: '#00FF88', fontSize: '14px', fontWeight: 900 }}>PROJECTED PAYOUT</span>
                    <span style={{ color: '#00FF88', fontSize: '16px', fontWeight: 900 }}>{formatMoney((selectedStaff.sal + (selectedStaff.revImpact * (selectedStaff.commRate/100))))}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
                  <button style={actionBtn('#D4AF37', '11px', '15px')} onClick={() => handleGeneratePayslip(selectedStaff.id)}>📄 AUTO-GENERATE OFFICIAL PAYSLIP</button>
                  <button style={actionBtn('#888', '11px', '15px')}>VIEW INCIDENT LOGS</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ── JD EDITOR OVERLAY ── */}
        {showJDEditor && jdDraft && (
          <div style={overlay}>
            <div style={{ ...dossierCard, maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => { setShowJDEditor(false); setJdDraft(null); }} style={closeBtn}>×</button>
              <h2 style={{ color: '#FF8C00', fontFamily: 'Cinzel', fontSize: '22px', marginBottom: '5px' }}>🤖 AGI JOB DESCRIPTION</h2>
              <p style={{ color: '#666', fontSize: '11px', marginBottom: '20px' }}>SHRM + ILO Standard · Review and save to proceed to GM approval.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div><label style={labelStyle}>JOB TITLE</label><input value={jdDraft.title || ''} onChange={e => setJdDraft({...jdDraft, title: e.target.value})} style={inputStyle}/></div>
                <div><label style={labelStyle}>POSITIONS</label><input type="number" value={jdDraft.positions_count || 1} onChange={e => setJdDraft({...jdDraft, positions_count: parseInt(e.target.value)})} style={inputStyle}/></div>
                <div><label style={labelStyle}>SALARY MIN (AED)</label><input type="number" value={jdDraft.salary_min || ''} onChange={e => setJdDraft({...jdDraft, salary_min: parseFloat(e.target.value)})} style={inputStyle}/></div>
                <div><label style={labelStyle}>SALARY MAX (AED)</label><input type="number" value={jdDraft.salary_max || ''} onChange={e => setJdDraft({...jdDraft, salary_max: parseFloat(e.target.value)})} style={inputStyle}/></div>
              </div>
              <div style={{ marginBottom: '15px' }}><label style={labelStyle}>ROLE SUMMARY</label><textarea value={jdDraft.role_summary || ''} onChange={e => setJdDraft({...jdDraft, role_summary: e.target.value})} rows={4} style={{ ...inputStyle, resize: 'vertical' as const }}/></div>
              <div style={{ marginBottom: '15px' }}><label style={labelStyle}>WORKING CONDITIONS</label><input value={jdDraft.working_conditions || ''} onChange={e => setJdDraft({...jdDraft, working_conditions: e.target.value})} style={inputStyle}/></div>
              
              {/* LinkedIn/Indeed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>LINKEDIN JOB URL (optional)</label><input value={jdDraft.linkedin_url || ''} onChange={e => setJdDraft({...jdDraft, linkedin_url: e.target.value})} placeholder="https://linkedin.com/jobs/..." style={inputStyle}/></div>
                <div><label style={labelStyle}>INDEED URL (optional)</label><input value={jdDraft.indeed_url || ''} onChange={e => setJdDraft({...jdDraft, indeed_url: e.target.value})} placeholder="https://indeed.com/..." style={inputStyle}/></div>
              </div>

              <div style={{ background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '20px' }}>
                <div style={{ color: '#39FF14', fontSize: '10px', fontWeight: 800, marginBottom: '6px' }}>✅ UAE STANDARD BENEFITS (AUTO-INCLUDED)</div>
                <div style={{ color: '#888', fontSize: '10px' }}>{UAE_BENEFITS_LABEL}</div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={saveVacancy} disabled={isSavingVacancy} style={{ flex: 1, ...actionBtn('#FF8C00', '12px', '15px') }}>
                  {isSavingVacancy ? 'SAVING...' : '💾 SAVE AS DRAFT'}
                </button>
                <button onClick={() => { setShowJDEditor(false); setJdDraft(null); }} style={{ flex: 1, ...actionBtn('#666', '12px', '15px') }}>CANCEL</button>
              </div>
            </div>
          </div>
        )}

      <style dangerouslySetInnerHTML={{__html: `
        .glass-card { transition: 0.3s; cursor: pointer; }
        .glass-card:hover { transform: translateY(-5px); border-color: #00F2FF !important; box-shadow: 0 15px 40px rgba(0,242,255,0.2) !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}} />
    </div>
  );
}

const UAE_BENEFITS_LABEL = 'Accommodation · UAE Visa & Work Permit · Medical Insurance · Annual Return Flight · Daily Meals · Transportation · 30 Days Annual Leave · End of Service Gratuity (UAE Labour Law)';


// --- SOVEREIGN RETINA STYLES ---
const mainViewport = { padding: '40px', maxWidth: '1800px', margin: '0 auto', minHeight: '100vh', backgroundImage: 'radial-gradient(circle at center, rgba(0,242,255,0.03) 0%, transparent 70%)' };
const headerFrame = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '30px', marginBottom: '30px' };
const titleStyle = { fontFamily: 'Cinzel', color: '#D4AF37', fontSize: '32px', letterSpacing: '4px', margin: 0 };
const subTitleStyle = { color: '#00F2FF', fontSize: '10px', fontWeight: 900, letterSpacing: '2px', marginTop: '10px' };
const telemetryChip = { background: 'rgba(0, 242, 255, 0.05)', border: '1px solid #00F2FF', color: '#00F2FF', padding: '15px 25px', borderRadius: '12px', fontWeight: 900, fontSize: '12px' };
const tabStyle = (active: boolean, color: string) => ({ background: active ? `rgba(${active ? '0,242,255' : '255,255,255'}, 0.1)` : 'transparent', color: active ? color : '#666', border: active ? `1px solid ${color}` : '1px solid transparent', padding: '12px 25px', borderRadius: '12px', fontWeight: 900, fontSize: '10px', cursor: 'pointer', transition: '0.3s' });
const contentBox = { background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)', minHeight: '650px' };

const gridMatrix = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '25px' };
const staffCard = (onDuty: boolean) => ({ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '24px', border: `1px solid ${onDuty ? '#39FF14' : 'rgba(255,255,255,0.05)'}`, textAlign: 'center' as const, position: 'relative' as const });
const avatarCircle = { width: '80px', height: '80px', borderRadius: '50%', background: '#000', border: '2px solid #D4AF37', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', boxShadow: '0 0 20px rgba(212,175,55,0.2)' };
const statusBadge = (s: string) => ({ position: 'absolute' as const, top: '15px', right: '15px', fontSize: '8px', padding: '5px 12px', borderRadius: '20px', background: s === 'ON-DUTY' ? '#39FF14' : '#444', color: '#000', fontWeight: 900 });
const miniStatRow = { display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px', fontSize: '9px', color: '#666' };

const glassPanel = (c: string) => ({ background: 'rgba(255,255,255,0.02)', padding: '35px', borderRadius: '24px', border: `1px solid ${c}33`, borderTop: '1px solid rgba(255,255,255,0.1)' });
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' };
const inputStyle = { width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '12px', color: '#FFF', fontSize: '11px', outline: 'none' };
const labelStyle = { display: 'block', fontSize: '9px', fontWeight: 900, color: '#666', marginBottom: '8px', letterSpacing: '1px' };

const tableStyle = { width: '100%', borderCollapse: 'separate' as const, borderSpacing: '0 10px' };
const headerRow = { textAlign: 'left' as const, color: '#666', fontSize: '10px', textTransform: 'uppercase' as const };
const dataRow = { background: 'rgba(255,255,255,0.02)', fontSize: '13px' };
const actionBtn = (c: string, f = '12px', p = '20px') => ({ width: '100%', padding: p, background: 'rgba(0,0,0,0.4)', border: `1px solid ${c}`, color: c, fontWeight: 900, borderRadius: '12px', cursor: 'pointer', fontSize: f, transition: '0.3s' });
const ghostInput = { background: 'transparent', border: 'none', borderBottom: '1px solid #333', color: '#FFF', fontSize: '13px', padding: '5px', width: '100%', outline: 'none' };
// Dark select: explicit background so native OS dropdown doesn't render white
const darkSelect = { background: '#111', border: '1px solid rgba(255,255,255,0.12)', color: '#FFF', fontSize: '10px', padding: '5px 8px', width: '100%', outline: 'none', borderRadius: '6px', cursor: 'pointer' };

const selectStyle = { background: '#000', color: '#00F2FF', border: '1px solid #00F2FF', padding: '8px', borderRadius: '6px', fontSize: '9px', outline: 'none' };
const uploadBtn = { cursor: 'pointer', background: 'rgba(0, 242, 255, 0.1)', border: '1px solid #00F2FF', color: '#00F2FF', padding: '8px 15px', borderRadius: '6px', fontSize: '9px', fontWeight: 900 };
const docItem = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', fontSize: '12px', color: '#FFF', border: '1px solid rgba(255,255,255,0.05)' };
const ghostBtn = { background: 'transparent', border: '1px solid #00F2FF', color: '#00F2FF', padding: '8px 15px', borderRadius: '6px', fontSize: '9px', fontWeight: 900, cursor: 'pointer' };

const overlay = { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const dossierCard = { background: 'linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(5,5,5,1) 100%)', border: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.2)', padding: '50px', borderRadius: '32px', width: '90%', maxWidth: '950px', position: 'relative' as const, boxShadow: '0 30px 60px rgba(0,0,0,0.9)' };
const dossierAvatar = { width: '180px', height: '180px', borderRadius: '24px', background: '#000', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', boxShadow: 'inset 0 0 20px rgba(0,242,255,0.1)' };
const metricGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '30px' };
const metricItem = { display: 'flex', flexDirection: 'column' as const, gap: '5px' };
const financialStructureBox = { background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)', padding: '25px', borderRadius: '16px', marginTop: '30px' };
const closeBtn = { position: 'absolute' as const, top: '25px', right: '30px', background: 'none', border: 'none', color: '#666', fontSize: '40px', cursor: 'pointer', transition: '0.2s' };
