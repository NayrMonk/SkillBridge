import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/api/client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Github,
  Globe,
  Linkedin,
  Plus,
  Trash2,
  Twitter,
  Upload,
  X
} from 'lucide-react';

const steps = ['Headline & Bio', 'Location', 'Upload CV', 'Social Links'];

type SocialPlatform = 'linkedin' | 'github' | 'twitter' | 'upwork' | 'fiverr' | 'portfolio' | 'other';

type SocialLinkInput = {
  id: string;
  platform: SocialPlatform;
  url: string;
};

const platformOptions: Array<{ value: SocialPlatform; label: string }> = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'upwork', label: 'Upwork' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'other', label: 'Other' }
];

const getPlatformIcon = (platform: SocialPlatform) => {
  switch (platform) {
    case 'linkedin':
      return Linkedin;
    case 'github':
      return Github;
    case 'twitter':
      return Twitter;
    default:
      return Globe;
  }
};

const detectPlatform = (value: string): SocialPlatform => {
  const url = value.toLowerCase();
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('github.com')) return 'github';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('upwork.com')) return 'upwork';
  if (url.includes('fiverr.com')) return 'fiverr';
  return 'portfolio';
};

const createLink = (): SocialLinkInput => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  platform: 'linkedin',
  url: ''
});

const normalizeUrl = (value: string) => {
  if (!value.trim()) return '';
  const withProtocol = /^https?:\/\//i.test(value) ? value.trim() : `https://${value.trim()}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

export default function ProfileCompletion() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cvFileName, setCvFileName] = useState('');
  const [cvFileType, setCvFileType] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinkInput[]>([createLink()]);

  const [formData, setFormData] = useState({
    headline: '',
    bio: '',
    location: '',
    cvDataUrl: ''
  });

  const cvAccept = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const submitUrlMap = useMemo(() => {
    const normalized = socialLinks
      .map((item) => ({ ...item, url: normalizeUrl(item.url) }))
      .filter((item) => item.url);

    const firstByPlatform = (platform: SocialPlatform) => {
      return normalized.find((item) => item.platform === platform)?.url || '';
    };

    const portfolioUrl = firstByPlatform('portfolio') || normalized.find((item) => item.platform === 'other')?.url || '';

    return {
      socialLinks: normalized,
      linkedinUrl: firstByPlatform('linkedin'),
      githubUrl: firstByPlatform('github'),
      upworkUrl: firstByPlatform('upwork'),
      fiverrUrl: firstByPlatform('fiverr'),
      websiteUrl: portfolioUrl
    };
  }, [socialLinks]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('CV file must be under 5MB');
      return;
    }

    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      setError('Please upload PDF, DOC, or DOCX files only');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        cvDataUrl: String(reader.result || '')
      }));
      setCvFileName(file.name);
      setCvFileType(file.type || 'application/pdf');
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read CV file');
    };
    reader.readAsDataURL(file);
  };

  const removeCv = () => {
    setFormData((prev) => ({ ...prev, cvDataUrl: '' }));
    setCvFileName('');
    setCvFileType('');
  };

  const addSocialLink = () => {
    setSocialLinks((prev) => [...prev, createLink()]);
  };

  const removeSocialLink = (id: string) => {
    setSocialLinks((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], url: '' }];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateSocialLink = (id: string, updates: Partial<SocialLinkInput>) => {
    setSocialLinks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const nextUrl = updates.url ?? item.url;
        const shouldAutoDetect = updates.url !== undefined && (!updates.platform || item.platform === 'other' || item.platform === 'portfolio');

        return {
          ...item,
          ...updates,
          platform: shouldAutoDetect ? detectPlatform(nextUrl) : (updates.platform ?? item.platform)
        };
      })
    );
  };

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const hasInvalidLink = socialLinks.some((item) => item.url.trim() && !normalizeUrl(item.url));
      if (hasInvalidLink) {
        setError('Please fix invalid social link URLs or clear them before continuing');
        setLoading(false);
        return;
      }

      await api.completeProfile({
        cvDataUrl: formData.cvDataUrl,
        cvFileName,
        cvFileType,
        socialLinks: submitUrlMap.socialLinks,
        linkedinUrl: submitUrlMap.linkedinUrl,
        githubUrl: submitUrlMap.githubUrl,
        upworkUrl: submitUrlMap.upworkUrl,
        fiverrUrl: submitUrlMap.fiverrUrl,
        websiteUrl: submitUrlMap.websiteUrl,
        headline: formData.headline,
        bio: formData.bio,
        location: formData.location
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E1B14] to-[#1A3828] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-white shadow-xl">
        <div className="p-5 sm:p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-[#1A6B47] mb-2">Complete Your Profile</h1>
            <p className="text-gray-600">Add your professional details to get started (optional fields can be skipped)</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">Profile completed! Redirecting...</AlertDescription>
            </Alert>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between gap-2">
              {steps.map((stepLabel, index) => (
                <div key={stepLabel} className="flex-1">
                  <div className={`h-1 rounded-full ${index <= step ? 'bg-[#1A6B47]' : 'bg-gray-200'}`} />
                  <p className={`mt-2 text-xs ${index === step ? 'text-[#1A6B47] font-semibold' : 'text-gray-500'}`}>
                    {index + 1}. {stepLabel}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-[#1A6B47]/15 p-4 sm:p-6 transition-all duration-300 ease-out">
            {step === 0 && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100 translate-y-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Headline & Bio</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Headline <span className="text-gray-500 font-normal">(optional)</span></label>
                    <Input
                      type="text"
                      name="headline"
                      placeholder="e.g., Full Stack Developer | React Specialist"
                      value={formData.headline}
                      onChange={handleChange}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio <span className="text-gray-500 font-normal">(optional)</span></label>
                    <Textarea
                      name="bio"
                      placeholder="Tell clients about yourself, your experience, and expertise..."
                      value={formData.bio}
                      onChange={handleChange}
                      rows={5}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100 translate-y-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Where are you based? <span className="text-gray-500 font-normal">(optional)</span></label>
                  <Input
                    type="text"
                    name="location"
                    placeholder="e.g., Lahore, Pakistan"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100 translate-y-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload CV</h2>
                <p className="text-sm text-gray-600">PDF is preferred. You can skip this and add it later.</p>

                {!cvFileName && (
                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#1A6B47]/30 bg-[#1A6B47]/5 px-4 py-6 text-sm font-medium text-[#1A6B47] hover:bg-[#1A6B47]/10 transition-colors">
                    <Upload className="h-4 w-4" />
                    Choose CV file
                    <Input type="file" accept={cvAccept} onChange={handleCvUpload} className="hidden" />
                  </label>
                )}

                {cvFileName && (
                  <div className="rounded-lg border border-[#1A6B47]/20 bg-[#1A6B47]/5 p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-[#1A6B47]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{cvFileName}</p>
                        <p className="text-xs text-gray-500">Uploaded. You can replace or remove anytime.</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-[#1A6B47]/25 px-3 py-1.5 text-xs font-medium text-[#1A6B47] hover:bg-[#1A6B47]/10">
                        Replace
                        <Input type="file" accept={cvAccept} onChange={handleCvUpload} className="hidden" />
                      </label>
                      <Button type="button" variant="outline" size="sm" onClick={removeCv} className="text-xs">
                        <X className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">Allowed: PDF, DOC, DOCX up to 5MB</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 transition-all duration-300 ease-out opacity-100 translate-y-0">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Social & Freelance Links</h2>
                <p className="text-sm text-gray-600">Add as many links as you want. Every field is optional.</p>

                <div className="space-y-3">
                  {socialLinks.map((link) => {
                    const PlatformIcon = getPlatformIcon(link.platform);
                    return (
                      <div key={link.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr_auto]">
                        <div className="relative">
                          <select
                            value={link.platform}
                            onChange={(e) => updateSocialLink(link.id, { platform: e.target.value as SocialPlatform })}
                            className="h-10 w-full rounded-md border border-gray-300 bg-white pl-9 pr-2 text-sm"
                          >
                            {platformOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <PlatformIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1A6B47]" />
                        </div>

                        <Input
                          type="url"
                          placeholder="https://your-link.com"
                          value={link.url}
                          onChange={(e) => updateSocialLink(link.id, { url: e.target.value })}
                        />

                        <Button type="button" variant="outline" onClick={() => removeSocialLink(link.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  <div>
                    <Button type="button" variant="outline" onClick={addSocialLink}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add another link
                    </Button>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={prevStep} disabled={loading} className="flex-1 min-w-[130px]">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}

              {step < steps.length - 1 ? (
                <Button type="button" onClick={nextStep} className="flex-1 min-w-[130px] bg-[#1A6B47] hover:bg-[#135038] text-white">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 min-w-[160px] bg-[#1A6B47] hover:bg-[#135038] text-white"
                >
                  {loading ? 'Completing...' : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Complete Profile
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
                className="flex-1 min-w-[130px]"
              >
                Skip for Now
              </Button>
            </div>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            You can update these details anytime from your profile settings
          </p>
        </div>
      </Card>
    </div>
  );
}
