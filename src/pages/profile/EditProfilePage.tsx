import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Plus,
  X,
  Save,
  Loader2,
  Github,
  Linkedin,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';

const availabilityOptions = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'not_available', label: 'Not Available' }
];

export const EditProfilePage = () => {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<any>({});
  const [skills, setSkills] = useState<any[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [proficiencyLevel, setProficiencyLevel] = useState('3');
  
  // Portfolio
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [newPortfolioItem, setNewPortfolioItem] = useState({
    title: '',
    description: '',
    projectUrl: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [profileRes, skillsRes] = await Promise.all([
        api.getProfile(),
        api.getSkills()
      ]);
      
      setProfile(profileRes.profile);
      setSkills(profileRes.profile.skills || []);
      setPortfolioItems(profileRes.profile.portfolio || []);
      setAllSkills(skillsRes.skills);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.updateProfile({
        displayName: profile.display_name,
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        timezone: profile.timezone,
        websiteUrl: profile.website_url,
        linkedinUrl: profile.linkedin_url,
        githubUrl: profile.github_url,
        hourlyRate: profile.hourly_rate,
        availability: profile.availability
      });
      
      updateUser({
        displayName: profile.display_name,
        headline: profile.headline
      });
      
      toast.success('Profile updated successfully');
      navigate('/dashboard/profile');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkill = async () => {
    if (!selectedSkill) return;
    
    try {
      await api.addSkill(selectedSkill, parseInt(proficiencyLevel));
      const skill = allSkills.find(s => s.id === selectedSkill);
      setSkills([...skills, { ...skill, proficiency_level: parseInt(proficiencyLevel) }]);
      setSelectedSkill('');
      toast.success('Skill added');
    } catch (error) {
      toast.error('Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    try {
      await api.removeSkill(skillId);
      setSkills(skills.filter(s => s.id !== skillId));
      toast.success('Skill removed');
    } catch (error) {
      toast.error('Failed to remove skill');
    }
  };

  const handleAddPortfolioItem = async () => {
    if (!newPortfolioItem.title) return;
    
    try {
      const response = await api.addPortfolioItem(newPortfolioItem);
      setPortfolioItems([...portfolioItems, response.item]);
      setNewPortfolioItem({ title: '', description: '', projectUrl: '' });
      toast.success('Portfolio item added');
    } catch (error) {
      toast.error('Failed to add portfolio item');
    }
  };

  const handleRemovePortfolioItem = async (id: string) => {
    try {
      await api.deletePortfolioItem(id);
      setPortfolioItems(portfolioItems.filter(item => item.id !== id));
      toast.success('Portfolio item removed');
    } catch (error) {
      toast.error('Failed to remove portfolio item');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/profile')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Edit Profile</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={profile.display_name || ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={profile.headline || ''}
                onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                placeholder="e.g. Full Stack Developer"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={4}
                placeholder="Tell us about yourself..."
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location || ''}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="e.g. New York, USA"
              />
            </div>
            {user?.role === 'freelancer' && (
              <div>
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={profile.hourly_rate || ''}
                  onChange={(e) => setProfile({ ...profile, hourly_rate: parseFloat(e.target.value) })}
                  placeholder="e.g. 50"
                />
              </div>
            )}
            <div>
              <Label htmlFor="availability">Availability</Label>
              <Select
                value={profile.availability}
                onValueChange={(value) => setProfile({ ...profile, availability: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availabilityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Links */}
        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              <Input
                id="website"
                value={profile.website_url || ''}
                onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div>
              <Label htmlFor="linkedin" className="flex items-center gap-2">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Label>
              <Input
                id="linkedin"
                value={profile.linkedin_url || ''}
                onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
            <div>
              <Label htmlFor="github" className="flex items-center gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </Label>
              <Input
                id="github"
                value={profile.github_url || ''}
                onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                placeholder="https://github.com/yourusername"
              />
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  {allSkills
                    .filter(s => !skills.find(us => us.id === s.id))
                    .map(skill => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={proficiencyLevel} onValueChange={setProficiencyLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Beginner</SelectItem>
                  <SelectItem value="2">Basic</SelectItem>
                  <SelectItem value="3">Intermediate</SelectItem>
                  <SelectItem value="4">Advanced</SelectItem>
                  <SelectItem value="5">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddSkill} disabled={!selectedSkill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill.id} variant="secondary" className="flex items-center gap-1">
                  {skill.name}
                  <span className="text-xs opacity-70">({skill.proficiency_level}/5)</span>
                  <button
                    onClick={() => handleRemoveSkill(skill.id)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio */}
        <Card>
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Project title"
                value={newPortfolioItem.title}
                onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, title: e.target.value })}
              />
              <Textarea
                placeholder="Project description"
                value={newPortfolioItem.description}
                onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, description: e.target.value })}
                rows={2}
              />
              <Input
                placeholder="Project URL (optional)"
                value={newPortfolioItem.projectUrl}
                onChange={(e) => setNewPortfolioItem({ ...newPortfolioItem, projectUrl: e.target.value })}
              />
              <Button 
                onClick={handleAddPortfolioItem} 
                disabled={!newPortfolioItem.title}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Portfolio Item
              </Button>
            </div>
            <div className="space-y-2">
              {portfolioItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {item.project_url && (
                      <a 
                        href={item.project_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-brand hover:underline"
                      >
                        View Project
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemovePortfolioItem(item.id)}
                    className="text-ink-4 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
