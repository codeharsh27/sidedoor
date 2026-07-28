import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, Link as LinkIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { UserProfile } from '../types/schema';

interface ResumeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
}

export const ResumeUploadModal: React.FC<ResumeUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [portfolioLink, setPortfolioLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 0: upload, 1: parsing, 2: success

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file && !portfolioLink) return;
    
    setIsUploading(true);
    setProgressStep(0);

    const progressInterval = setInterval(() => {
      setProgressStep(prev => prev < 2 ? prev + 1 : prev);
    }, 1000);

    try {
      const profile = await apiClient.uploadResume(file || undefined, portfolioLink);
      clearInterval(progressInterval);
      setProgressStep(2);
      
      setTimeout(() => {
        onSuccess(profile);
        setIsUploading(false);
        setProgressStep(0);
        setFile(null);
        setPortfolioLink('');
      }, 800);
      
    } catch (error) {
      console.error(error);
      setIsUploading(false);
      clearInterval(progressInterval);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#111',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '32px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        color: 'white',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)'
      }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          disabled={isUploading}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            opacity: isUploading ? 0.3 : 1
          }}
          onMouseEnter={(e) => {
            if (!isUploading) {
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isUploading) {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <X size={20} />
        </button>

        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>Build Your Profile</h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>
            Upload your resume or paste a link. We extract your core skills to find high-signal gaps you can actually solve.
          </p>
        </div>

        {!isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('resume-upload')?.click()}
              style={{
                border: dragActive ? '2px dashed var(--accent-gold)' : '2px dashed rgba(255, 255, 255, 0.15)',
                backgroundColor: dragActive ? 'rgba(152, 118, 26, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '16px',
                padding: '40px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!dragActive) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!dragActive) {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }
              }}
            >
              <input 
                id="resume-upload" 
                type="file" 
                accept=".pdf,.doc,.docx" 
                style={{ display: 'none' }}
                onChange={handleChange}
              />
              
              {file ? (
                <>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <FileText size={24} color="white" />
                  </div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem' }}>{file.name}</p>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(152, 118, 26, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <Upload size={28} color="var(--accent-gold, #fde047)" />
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontWeight: 500, fontSize: '1rem', color: 'white' }}>Click or drag resume to upload</p>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.85rem' }}>PDF or DOCX (max. 5MB)</p>
                </>
              )}
            </div>

            {/* OR separator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
            </div>

            {/* Link Input */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '16px', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                <LinkIcon size={18} color="rgba(255, 255, 255, 0.4)" />
              </div>
              <input
                type="text"
                placeholder="Portfolio or GitHub URL"
                value={portfolioLink}
                onChange={(e) => setPortfolioLink(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 44px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-gold, #fde047)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            <button 
              onClick={handleUpload}
              disabled={!file && !portfolioLink}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: (!file && !portfolioLink) ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-gold, #fde047)',
                color: (!file && !portfolioLink) ? 'rgba(255, 255, 255, 0.3)' : '#111',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: (!file && !portfolioLink) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                if (file || portfolioLink) {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (file || portfolioLink) {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = 'none';
                }
              }}
            >
              Analyze Profile
            </button>
          </div>
        ) : (
          <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {progressStep === 0 && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div className="spinner" style={{ marginBottom: '24px' }}>
                  <Loader2 size={48} color="var(--accent-gold, #fde047)" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Uploading Document...</h3>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>Connecting to secure pipeline</p>
              </div>
            )}
            
            {progressStep === 1 && (
              <div style={{ animation: 'fadeInUp 0.4s ease' }}>
                <div style={{ position: 'relative', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                  <Loader2 size={48} color="#60a5fa" style={{ animation: 'spin 1.5s linear infinite' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', backgroundColor: '#60a5fa', borderRadius: '50%', animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Extracting Skills via LLM...</h3>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>Generating semantic embeddings for matching</p>
              </div>
            )}
            
            {progressStep === 2 && (
              <div style={{ animation: 'fadeInUp 0.4s ease' }}>
                <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                  <CheckCircle2 size={56} color="#4ade80" />
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600 }}>Profile Built</h3>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>Redirecting to dashboard...</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}
      </style>
    </div>
  );
};
