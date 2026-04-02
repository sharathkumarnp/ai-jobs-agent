'use client';

import React, { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { cn } from '@/components/WorkflowCanvas/Nodes'; // Re-use merging function
import { initFirebaseAuth } from '@/lib/firebase';

type WorkMode = '' | 'Remote' | 'Hybrid' | 'On-site';

export const ConfigurationBlueprint = () => {
  const [docUploaded, setDocUploaded] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('');
  const [sliderVal, setSliderVal] = useState(0);
  const [compensation, setCompensation] = useState(0);
  const [currency, setCurrency] = useState('');
  const [blacklisted, setBlacklisted] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const router = useRouter();
  const pushLog = useWorkflowStore(s => s.pushLog);
  const setBlueprintConfig = useWorkflowStore(s => s.setBlueprintConfig);
  const blueprintConfig = useWorkflowStore(s => s.blueprintConfig);
  const setMasterResumeText = useWorkflowStore(s => s.setMasterResumeText);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');

  useEffect(() => {
    setTargetRole(blueprintConfig.targetRole || '');
    setLocation(blueprintConfig.location || '');
    setWorkMode((blueprintConfig.workMode as WorkMode) || '');
    setSliderVal(Number.isFinite(blueprintConfig.experience) ? blueprintConfig.experience : 0);
    setCompensation(Number.isFinite(blueprintConfig.compensation) ? blueprintConfig.compensation : 0);
    setCurrency(typeof blueprintConfig.currency === 'string' ? blueprintConfig.currency : '');
    setBlacklisted(Array.isArray(blueprintConfig.blacklisted) ? blueprintConfig.blacklisted : []);
  }, [blueprintConfig]);

  const resolveLocationFromGoogleMaps = async () => {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Geolocation is not supported in this browser.');
      return;
    }

    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!mapsApiKey) {
      setLocationMessage('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.');
      return;
    }

    setIsResolvingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsApiKey}`;
          const res = await fetch(endpoint);
          const data = (await res.json()) as { results?: Array<{ formatted_address?: string }>; status?: string };
          const formatted = data.results?.[0]?.formatted_address;
          if (!formatted) {
            setLocationMessage('Unable to resolve location from Google Maps.');
            return;
          }
          setLocation(formatted);
          setLocationMessage('Location loaded from Google Maps.');
        } catch {
          setLocationMessage('Failed to load location from Google Maps.');
        } finally {
          setIsResolvingLocation(false);
        }
      },
      () => {
        setLocationMessage('Location permission denied.');
        setIsResolvingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const addKeyword = () => {
    const value = keywordInput.trim();
    if (!value) return;
    if (blacklisted.some((k) => k.toLowerCase() === value.toLowerCase())) {
      setKeywordInput('');
      return;
    }
    setBlacklisted((prev) => [...prev, value]);
    setKeywordInput('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFileName(file.name);
    
    const formData = new FormData();
    formData.append('resume', file);
    const auth = await initFirebaseAuth().catch(() => null);
    const user = auth?.currentUser ?? null;
    const idToken = await user?.getIdToken();
    formData.append('userId', user?.uid || 'anonymous');
    if (user?.email) {
      formData.append('userEmail', user.email);
    }

    try {
      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await res.json();
      
      if (data.text) {
        setMasterResumeText(data.text);
        setDocUploaded(true);
        pushLog({ nodeId: 'discovery', message: `Parsed ${file.name} successfully.` });
      }
    } catch(err) {
      console.error(err);
      pushLog({ nodeId: 'discovery', message: 'Failed to extract resume payload.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeploy = () => {
    setBlueprintConfig({
      targetRole,
      location,
      workMode,
      blacklisted,
      experience: sliderVal,
      compensation,
      currency,
    });
    pushLog({ nodeId: 'discovery', message: `Blueprint Deployed. Targeting: ${targetRole} in ${location}.` });
    router.push('/');
  };
  
  return (
    <div className="space-y-8 premium-enter w-full min-w-0 max-w-none" style={{ width: '100%', maxWidth: 'none' }}>
      
      {/* SECTION 1: MASTER RESUME UPLOAD */}
      <section className="p-7 md:p-8 rounded-2xl premium-card transition-all duration-300 hover:border-indigo-200/40 premium-hover-lift w-full">
        <h3 className="text-xl font-semibold text-white mb-5">Master Asset</h3>
        {!docUploaded ? (
          <label className="flex flex-col flex-1 items-center justify-center p-12 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/5 hover:border-indigo-200/50 transition-all group relative">
            <input 
              type="file" 
              accept=".pdf,.txt,.docx" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            <UploadCloud size={48} className={`text-zinc-500 mb-4 ${isUploading ? 'animate-bounce text-indigo-200' : 'group-hover:text-indigo-200 group-hover:-translate-y-2 transition-all duration-300'}`} />
            <p className="text-zinc-300 font-medium">
              {isUploading ? 'Parsing Document...' : 'Drag & Drop your baseline PDF Resume'}
            </p>
            <p className="text-zinc-600 text-sm mt-1">We&apos;ll natively extract metadata via pdf-parse.</p>
          </label>
        ) : (
          <div className="flex animate-in fade-in zoom-in duration-500">
            <div className="w-full bg-indigo-300/10 border border-indigo-200/25 p-4 rounded-xl flex items-start space-x-4 premium-hover-lift">
              <CheckCircle2 className="text-indigo-200 shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="text-indigo-100 font-medium">{uploadFileName || 'Resume_Baseline.pdf'} successfully converted to Base Context</h4>
                <p className="text-sm text-zinc-400 mb-3">5 key skill clusters detected. Engine standing by to expand synonyms during application generation.</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="bg-indigo-300/20 text-indigo-100 text-xs px-2.5 py-1 rounded-md border border-indigo-200/30 flex items-center premium-hover-lift">
                      {s}
                      <X size={12} className="ml-1 cursor-pointer hover:text-white" onClick={() => setSkills(skills.filter(x => x !== s))}/>
                    </span>
                  ))}
                  <button className="btn-violet text-xs px-2.5 py-1 rounded-md transition-colors">
                    + Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: GLOBAL FLAGS & FILTERS */}
      <section className="p-7 md:p-8 rounded-2xl premium-card premium-hover-lift w-full">
        <h3 className="text-xl font-semibold text-white mb-7">Engine Restrictions & Parameters</h3>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 xl:gap-12">
          
          <div className="space-y-7">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Target Role Syntax</label>
              <input 
                type="text" 
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                  className="premium-input rounded-lg px-4 py-3 text-white transition-colors"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Location Parameter</label>
              <input 
                type="text" 
                value={location}
                onChange={e => setLocation(e.target.value)}
                  className="premium-input rounded-lg px-4 py-3 text-white transition-colors"
                placeholder="Load from Google Maps or type manually..."
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={resolveLocationFromGoogleMaps}
                  disabled={isResolvingLocation}
                  className="btn-subtle text-xs px-2.5 py-1.5 rounded-md disabled:opacity-60"
                >
                  {isResolvingLocation ? 'Loading...' : 'Use Google Maps Location'}
                </button>
                {locationMessage ? <span className="text-xs text-zinc-500">{locationMessage}</span> : null}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Work Mode Enforcement</label>
              <div className="flex bg-black/30 border border-white/10 p-1.5 rounded-lg">
                {(['Remote', 'Hybrid', 'On-site'] as WorkMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setWorkMode(mode)}
                    className={cn(
                      "flex-1 text-sm py-2 rounded-md transition-all font-medium premium-hover-lift",
                      workMode === mode ? "bg-indigo-300/20 text-indigo-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Maximum Commute / Experience Caps</label>
              <div className="flex py-2 px-1">
                <span className="text-zinc-500 text-sm w-16">Entry</span>
                <input 
                  type="range" 
                  min="0" max="50" 
                  value={sliderVal}
                  onChange={e => setSliderVal(parseInt(e.target.value))}
                  className="flex-1 accent-indigo-300 cursor-pointer" 
                />
                <span className="text-indigo-100 text-sm font-mono w-16 text-right">{sliderVal}+ YOE</span>
              </div>
            </div>
          </div>

          <div className="space-y-7">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Compensation Floor</label>
              <div className="relative flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="premium-input rounded-lg px-3 py-3 text-white min-w-[96px]"
                >
                  <option value="">Currency</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input 
                  type="number" 
                  value={compensation}
                  onChange={e => setCompensation(parseInt(e.target.value) || 0)}
                  className="w-full premium-input rounded-lg pl-4 pr-4 py-3 text-white font-mono transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-zinc-400 mb-2">Blacklist Keywords (Hard Discard)</label>
              <div className="bg-black/40 border border-white/10 rounded-lg p-3 min-h-[120px] focus-within:border-indigo-200/50 transition-colors">
                <div className="flex flex-wrap gap-2">
                  {blacklisted.map((keyword) => (
                    <span key={keyword} className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1.5 rounded-md border border-red-500/20 flex items-center">
                      {keyword}
                      <X
                        size={12}
                        className="ml-1 cursor-pointer hover:text-white"
                        onClick={() => setBlacklisted((prev) => prev.filter((k) => k !== keyword))}
                      />
                    </span>
                  ))}
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    onBlur={addKeyword}
                    placeholder="Add keyword..."
                    className="bg-transparent border-none text-sm text-white outline-none w-24 flex-1 placeholder:text-zinc-700 min-w-[100px]"
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 flex justify-end">
          <button 
            onClick={handleDeploy}
            className="btn-success px-6 py-2.5 rounded-lg transition-colors"
          >
            Deploy Blueprint to Engine
          </button>
        </div>
      </section>

    </div>
  );
};
