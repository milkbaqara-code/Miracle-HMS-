// web/app/web/careers/page.tsx
// Miracle Sovereign Talent Engine — Public Careers Page
// SEO: schema.org JobPosting markup, meta tags, semantic HTML
'use client';
import { useState, useEffect } from 'react';

interface Vacancy {
  id: string; title: string; department: string; industry_vertical: string;
  executive_tier: string; zone: string; positions_count: number; location: string;
  role_summary: string; responsibilities: {order:number;text:string}[];
  requirements_mandatory: {type:string;text:string}[];
  competencies: string[]; working_conditions: string;
  salary_min: number; salary_max: number; currency: string;
  benefits: {title:string;detail:string}[];
  linkedin_url: string; indeed_url: string;
  closing_date: string; is_featured: boolean; published_at: string;
  applications_count: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function CareersPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<Vacancy | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', email: '', phone: '', nationality: '', location: '', notice: '', currentSalary: '', expectedSalary: '', coverLetter: '', linkedin: '' });
  const [cvFile, setCvFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`${API}/hr/talent/vacancies?status=PUBLISHED`)
      .then(r => r.json())
      .then(d => { setVacancies(d.vacancies || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const departments = ['ALL', ...Array.from(new Set(vacancies.map(v => v.department)))];
  const filtered = filter === 'ALL' ? vacancies : vacancies.filter(v => v.department === filter);

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('applicant_name', form.name);
    fd.append('applicant_email', form.email);
    fd.append('applicant_phone', form.phone);
    fd.append('applicant_nationality', form.nationality);
    fd.append('current_location', form.location);
    fd.append('notice_period', form.notice);
    fd.append('current_salary', form.currentSalary);
    fd.append('expected_salary', form.expectedSalary);
    fd.append('cover_letter', form.coverLetter);
    fd.append('linkedin_profile', form.linkedin);
    fd.append('source', 'WEBSITE');
    if (cvFile) fd.append('cv_file', cvFile);

    try {
      const res = await fetch(`${API}/hr/talent/apply/${selected.id}`, { method: 'POST', body: fd });
      if (res.ok) { setSubmitted(true); }
      else { alert('Submission failed. Please try again.'); }
    } catch { alert('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const tierColor = (tier: string) => tier === 'DIRECTOR' ? '#a855f7' : tier === 'MANAGER' ? '#D4AF37' : '#00F2FF';

  return (
    <>
      <head>
        <title>Careers — Join Miracle General Hospital & Diagnosis Center | Luxury Hospitality Jobs UAE</title>
        <meta name="description" content="Explore career opportunities at Miracle General Hospital & Diagnosis Center. Join our world-class hospitality team in UAE. View open positions across all departments." />
        <meta name="keywords" content="Miracle Resort jobs, UAE hospitality careers, luxury hotel jobs Dubai, hotel staff recruitment" />
        <meta property="og:title" content="Careers at Miracle General Hospital & Diagnosis Center" />
        <meta property="og:description" content="Join our team — luxury hospitality careers in UAE." />
      </head>

      <div style={{ background: '#050505', minHeight: '100vh', color: '#FFF', fontFamily: "'Inter', sans-serif" }}>
        
        {/* Hero */}
        <div style={{ position: 'relative', padding: '120px 40px 80px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(0,242,255,0.04) 0%, rgba(212,175,55,0.04) 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(0,242,255,0.06) 0%, transparent 60%), radial-gradient(circle at 70% 30%, rgba(212,175,55,0.05) 0%, transparent 50%)', pointerEvents: 'none' }} />
          <div style={{ display: 'inline-block', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '50px', padding: '6px 20px', fontSize: '11px', fontWeight: 800, color: '#D4AF37', letterSpacing: '2px', marginBottom: '25px' }}>
            ✦ SOVEREIGN TALENT PROGRAMME
          </div>
          <h1 style={{ fontFamily: "'Cinzel', serif", fontSize: '52px', fontWeight: 900, color: '#FFF', margin: '0 0 15px 0', lineHeight: '1.1', letterSpacing: '2px' }}>
            Shape the Future of<br/><span style={{ color: '#D4AF37' }}>Luxury Hospitality</span>
          </h1>
          <p style={{ color: '#888', fontSize: '16px', maxWidth: '600px', margin: '0 auto 35px', lineHeight: '1.7' }}>
            Join a world-class team at Miracle General Hospital & Diagnosis Center. We offer international-standard careers, UAE benefits package, and an environment where excellence is the only standard.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: '12px', padding: '12px 25px', fontSize: '13px' }}>
              <span style={{ color: '#39FF14', fontWeight: 900 }}>{vacancies.length}</span> <span style={{ color: '#888' }}>Open Positions</span>
            </div>
            <div style={{ background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.3)', borderRadius: '12px', padding: '12px 25px', fontSize: '13px' }}>
              <span style={{ color: '#00F2FF', fontWeight: 900 }}>30</span> <span style={{ color: '#888' }}>Departments</span>
            </div>
            <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '12px', padding: '12px 25px', fontSize: '13px' }}>
              <span style={{ color: '#D4AF37', fontWeight: 900 }}>UAE</span> <span style={{ color: '#888' }}>Visa & Benefits</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ padding: '30px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#666', fontSize: '11px', fontWeight: 800, letterSpacing: '1px', marginRight: '5px' }}>FILTER BY DEPARTMENT:</span>
          {departments.map(d => (
            <button key={d} onClick={() => setFilter(d)} style={{ background: filter === d ? 'rgba(212,175,55,0.15)' : 'transparent', color: filter === d ? '#D4AF37' : '#666', border: filter === d ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)', padding: '8px 18px', borderRadius: '50px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}>
              {d}
            </button>
          ))}
        </div>

        {/* Vacancy Listing */}
        <div style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#444' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px', animation: 'spin 1s linear infinite' }}>⟳</div>
              Loading opportunities...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#444', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🌟</div>
              <h3 style={{ color: '#666', fontFamily: 'Cinzel' }}>No open positions in this department right now.</h3>
              <p style={{ color: '#444', fontSize: '13px' }}>Check back soon or explore other departments.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
              {filtered.map(v => (
                <div key={v.id} onClick={() => setSelected(v)}
                  style={{ background: 'rgba(255,255,255,0.02)', border: v.is_featured ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)', borderTop: v.is_featured ? '3px solid #D4AF37' : '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '28px', cursor: 'pointer', transition: '0.3s', position: 'relative' as const }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.borderColor = '#D4AF37'; (e.currentTarget as HTMLElement).style.boxShadow = '0 20px 40px rgba(212,175,55,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = v.is_featured ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
                  {v.is_featured && <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontSize: '9px', fontWeight: 900, padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(212,175,55,0.3)' }}>★ FEATURED</div>}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>🏨</div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: '#FFF', fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', lineHeight: '1.3' }}>{v.title}</h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 600 }}>{v.department}</span>
                        <span style={{ color: '#444' }}>·</span>
                        <span style={{ color: tierColor(v.executive_tier), fontSize: '10px', fontWeight: 800 }}>{v.executive_tier}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ color: '#777', fontSize: '12px', lineHeight: '1.6', margin: '0 0 15px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{v.role_summary}</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
                    <span style={{ background: 'rgba(57,255,20,0.08)', color: '#39FF14', border: '1px solid rgba(57,255,20,0.2)', fontSize: '10px', padding: '4px 12px', borderRadius: '20px', fontWeight: 600 }}>📍 {v.location}</span>
                    {v.positions_count > 1 && <span style={{ background: 'rgba(0,242,255,0.08)', color: '#00F2FF', border: '1px solid rgba(0,242,255,0.2)', fontSize: '10px', padding: '4px 12px', borderRadius: '20px', fontWeight: 600 }}>{v.positions_count} Openings</span>}
                    {v.closing_date && <span style={{ background: 'rgba(255,255,255,0.04)', color: '#666', fontSize: '10px', padding: '4px 12px', borderRadius: '20px' }}>Closes {new Date(v.closing_date).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                    <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '13px' }}>
                      {v.currency} {(v.salary_min||0).toLocaleString()} – {(v.salary_max||0).toLocaleString()}<span style={{ color: '#555', fontSize: '10px', fontWeight: 400 }}>/mo</span>
                    </div>
                    <span style={{ color: '#D4AF37', fontSize: '12px', fontWeight: 700 }}>VIEW & APPLY →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Job Detail + Apply Modal */}
        {selected && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 20px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #050505 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', width: '100%', maxWidth: '900px', padding: '50px', position: 'relative' }}>
              <button onClick={() => { setSelected(null); setShowForm(false); setSubmitted(false); }} style={{ position: 'absolute', top: '20px', right: '25px', background: 'none', border: 'none', color: '#555', fontSize: '36px', cursor: 'pointer' }}>×</button>

              {!showForm ? (
                <>
                  <div style={{ marginBottom: '30px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 800, letterSpacing: '2px', marginBottom: '10px' }}>{selected.department} · {selected.zone}</div>
                    <h2 style={{ fontFamily: "'Cinzel', serif", color: '#FFF', fontSize: '32px', margin: '0 0 10px 0' }}>{selected.title}</h2>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      <span style={{ color: '#888', fontSize: '13px' }}>📍 {selected.location}</span>
                      <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '14px' }}>{selected.currency} {(selected.salary_min||0).toLocaleString()} – {(selected.salary_max||0).toLocaleString()}/mo</span>
                      {selected.positions_count > 1 && <span style={{ color: '#00F2FF', fontSize: '13px' }}>{selected.positions_count} Openings</span>}
                    </div>
                    <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.8' }}>{selected.role_summary}</p>
                  </div>

                  {selected.responsibilities?.length > 0 && (
                    <div style={{ marginBottom: '25px' }}>
                      <h4 style={{ color: '#D4AF37', fontWeight: 800, fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>KEY RESPONSIBILITIES</h4>
                      <ul style={{ paddingLeft: '20px', color: '#aaa', lineHeight: '2', margin: 0, fontSize: '13px' }}>
                        {selected.responsibilities.map((r, i) => <li key={i}>{r.text || String(r)}</li>)}
                      </ul>
                    </div>
                  )}

                  {selected.requirements_mandatory?.length > 0 && (
                    <div style={{ marginBottom: '25px' }}>
                      <h4 style={{ color: '#00F2FF', fontWeight: 800, fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>REQUIREMENTS</h4>
                      <ul style={{ paddingLeft: '20px', color: '#aaa', lineHeight: '2', margin: 0, fontSize: '13px' }}>
                        {selected.requirements_mandatory.map((r, i) => <li key={i}><strong style={{ color: '#666', textTransform: 'capitalize' }}>{r.type}:</strong> {r.text}</li>)}
                      </ul>
                    </div>
                  )}

                  {selected.benefits?.length > 0 && (
                    <div style={{ background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: '14px', padding: '20px', marginBottom: '25px' }}>
                      <h4 style={{ color: '#39FF14', fontWeight: 800, fontSize: '12px', letterSpacing: '2px', marginBottom: '12px' }}>✅ BENEFITS PACKAGE (UAE STANDARD)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {selected.benefits.map((b, i) => (
                          <div key={i} style={{ fontSize: '12px' }}>
                            <span style={{ color: '#39FF14', fontWeight: 700 }}>✓ {b.title}</span>
                            <span style={{ color: '#666', fontSize: '11px', display: 'block' }}>{b.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.working_conditions && (
                    <div style={{ marginBottom: '25px', color: '#777', fontSize: '13px' }}>
                      <strong style={{ color: '#888' }}>Working Conditions:</strong> {selected.working_conditions}
                    </div>
                  )}

                  {/* Apply Buttons */}
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowForm(true)} style={{ flex: 1, background: 'linear-gradient(135deg, #D4AF37 0%, #B8960C 100%)', border: 'none', color: '#000', padding: '18px 30px', borderRadius: '14px', fontWeight: 900, fontSize: '14px', cursor: 'pointer', letterSpacing: '1px', minWidth: '200px' }}>
                      📩 APPLY NOW
                    </button>
                    {selected.linkedin_url && (
                      <a href={selected.linkedin_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(0,119,181,0.15)', border: '1px solid #0077B5', color: '#0077B5', padding: '18px 30px', borderRadius: '14px', fontWeight: 900, fontSize: '14px', textDecoration: 'none', minWidth: '200px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0077B5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        APPLY ON LINKEDIN
                      </a>
                    )}
                    {selected.indeed_url && (
                      <a href={selected.indeed_url} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(35,87,165,0.15)', border: '1px solid #2357A5', color: '#2357A5', padding: '18px 30px', borderRadius: '14px', fontWeight: 900, fontSize: '14px', textDecoration: 'none', minWidth: '200px' }}>
                        APPLY ON INDEED
                      </a>
                    )}
                  </div>
                </>
              ) : submitted ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '64px', marginBottom: '20px', animation: 'fadeIn 0.5s ease' }}>✅</div>
                  <h2 style={{ fontFamily: "'Cinzel', serif", color: '#39FF14', fontSize: '28px', marginBottom: '10px' }}>Application Received!</h2>
                  <p style={{ color: '#888', fontSize: '14px', lineHeight: '1.7' }}>Thank you for applying for <strong style={{ color: '#D4AF37' }}>{selected.title}</strong>.<br/>Our HR team will review your application and be in touch within 5-7 working days.</p>
                  <button onClick={() => { setSelected(null); setShowForm(false); setSubmitted(false); }} style={{ marginTop: '30px', background: 'rgba(212,175,55,0.15)', border: '1px solid #D4AF37', color: '#D4AF37', padding: '14px 35px', borderRadius: '12px', fontWeight: 900, fontSize: '13px', cursor: 'pointer' }}>BROWSE MORE OPENINGS</button>
                </div>
              ) : (
                <form onSubmit={submitApplication}>
                  <h3 style={{ fontFamily: "'Cinzel', serif", color: '#D4AF37', fontSize: '22px', marginBottom: '5px' }}>Apply for {selected.title}</h3>
                  <p style={{ color: '#666', fontSize: '12px', marginBottom: '30px' }}>All fields marked * are required. Your data is handled in accordance with UAE data protection standards.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div><label style={lbl}>FULL NAME *</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inp} placeholder="Your full name"/></div>
                    <div><label style={lbl}>EMAIL ADDRESS *</label><input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={inp} placeholder="you@example.com"/></div>
                    <div><label style={lbl}>PHONE NUMBER</label><input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inp} placeholder="+971 XX XXX XXXX"/></div>
                    <div><label style={lbl}>NATIONALITY</label><input value={form.nationality} onChange={e => setForm({...form, nationality: e.target.value})} style={inp} placeholder="e.g. Pakistani"/></div>
                    <div><label style={lbl}>CURRENT LOCATION</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} style={inp} placeholder="City, Country"/></div>
                    <div><label style={lbl}>NOTICE PERIOD</label><input value={form.notice} onChange={e => setForm({...form, notice: e.target.value})} style={inp} placeholder="e.g. 1 month / Immediate"/></div>
                    <div><label style={lbl}>CURRENT SALARY (AED)</label><input value={form.currentSalary} onChange={e => setForm({...form, currentSalary: e.target.value})} style={inp} placeholder="e.g. 4,000"/></div>
                    <div><label style={lbl}>EXPECTED SALARY (AED)</label><input value={form.expectedSalary} onChange={e => setForm({...form, expectedSalary: e.target.value})} style={inp} placeholder="e.g. 6,000"/></div>
                  </div>
                  <div style={{ marginBottom: '15px' }}><label style={lbl}>LINKEDIN PROFILE URL</label><input value={form.linkedin} onChange={e => setForm({...form, linkedin: e.target.value})} style={inp} placeholder="https://linkedin.com/in/yourname"/></div>
                  <div style={{ marginBottom: '15px' }}><label style={lbl}>COVER LETTER</label><textarea value={form.coverLetter} onChange={e => setForm({...form, coverLetter: e.target.value})} rows={4} style={{ ...inp, resize: 'vertical' as const }} placeholder="Tell us why you're the right fit for this role..."/></div>
                  <div style={{ marginBottom: '25px' }}>
                    <label style={lbl}>UPLOAD CV / RESUME *</label>
                    <input type="file" accept=".pdf,.doc,.docx" onChange={e => setCvFile(e.target.files?.[0] || null)} style={{ color: '#888', fontSize: '13px' }}/>
                    <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>PDF, DOC, DOCX — max 5MB</div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <button type="submit" disabled={submitting} style={{ flex: 2, background: submitting ? 'rgba(212,175,55,0.3)' : 'linear-gradient(135deg, #D4AF37 0%, #B8960C 100%)', border: 'none', color: '#000', padding: '18px', borderRadius: '14px', fontWeight: 900, fontSize: '14px', cursor: submitting ? 'wait' : 'pointer' }}>
                      {submitting ? '⏳ SUBMITTING...' : '📩 SUBMIT APPLICATION'}
                    </button>
                    <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid #333', color: '#666', padding: '18px', borderRadius: '14px', fontWeight: 900, fontSize: '14px', cursor: 'pointer' }}>BACK</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* schema.org JobPosting structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Miracle General Hospital & Diagnosis Center — Open Positions",
          "itemListElement": vacancies.map((v, i) => ({
            "@type": "JobPosting",
            "position": i + 1,
            "title": v.title,
            "description": v.role_summary,
            "hiringOrganization": { "@type": "Organization", "name": "Miracle General Hospital & Diagnosis Center" },
            "jobLocation": { "@type": "Place", "address": v.location },
            "baseSalary": { "@type": "MonetaryAmount", "currency": v.currency, "value": { "@type": "QuantitativeValue", "minValue": v.salary_min, "maxValue": v.salary_max, "unitText": "MONTH" } },
            "validThrough": v.closing_date,
            "datePosted": v.published_at,
          }))
        }) }} />

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          body { margin: 0; background: #050505; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </div>
    </>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '9px', fontWeight: 800, color: '#555', marginBottom: '6px', letterSpacing: '1px' };
const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '13px 15px', borderRadius: '10px', color: '#FFF', fontSize: '13px', outline: 'none' };
