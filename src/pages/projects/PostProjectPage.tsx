import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Plus,
  X,
  Loader2,
  CheckCircle
} from 'lucide-react';

const categories = [
  'Web Development',
  'AI/ML',
  'Design',
  'Writing',
  'Video Editing',
  'Marketing',
  'Data Entry',
  'Customer Support'
];

const experienceLevels = [
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' }
];

const budgetTypes = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' }
];

const locationTypes = [
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' }
];

export const PostProjectPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newMilestone, setNewMilestone] = useState({ title: '', amount: '' });
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    experienceLevel: '',
    budgetType: 'fixed',
    budgetMin: '',
    budgetMax: '',
    duration: '',
    deadline: '',
    locationType: 'remote',
    visibility: 'public'
  });

  const handleAddSkill = () => {
    if (newSkill && !skills.includes(newSkill)) {
      setSkills([...skills, newSkill]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleAddMilestone = () => {
    if (newMilestone.title && newMilestone.amount) {
      setMilestones([...milestones, { ...newMilestone, id: Date.now() }]);
      setNewMilestone({ title: '', amount: '' });
    }
  };

  const handleRemoveMilestone = (id: number) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.description || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.createProject({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        experienceLevel: formData.experienceLevel,
        budgetType: formData.budgetType,
        budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : undefined,
        budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
        duration: formData.duration,
        deadline: formData.deadline,
        locationType: formData.locationType,
        visibility: formData.visibility,
        skillsRequired: skills,
        milestones: milestones.map(m => ({
          title: m.title,
          amount: parseFloat(m.amount)
        }))
      });
      
      toast.success('Project posted successfully!');
      navigate('/projects');
    } catch (error: any) {
      console.error('Post project error:', error);
      toast.error(error.response?.data?.error || 'Failed to post project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.title || !formData.description || !formData.category)) {
      toast.error('Please fill in all required fields');
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/client')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Post a Project</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-brand' : 'bg-canvas'}`} />
        <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-brand' : 'bg-canvas'}`} />
        <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-brand' : 'bg-canvas'}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && 'Project Details'}
            {step === 2 && 'Budget & Timeline'}
            {step === 3 && 'Additional Information'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="title">
                  Project Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. Build a responsive e-commerce website"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="category">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                />
              </div>

              <div>
                <Label>Skills Required</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add a skill (e.g. React, Node.js)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  />
                  <Button type="button" onClick={handleAddSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                      {skill}
                      <button onClick={() => handleRemoveSkill(skill)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budgetType">Budget Type</Label>
                  <Select
                    value={formData.budgetType}
                    onValueChange={(value) => setFormData({ ...formData, budgetType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {budgetTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="experienceLevel">Experience Level</Label>
                  <Select
                    value={formData.experienceLevel}
                    onValueChange={(value) => setFormData({ ...formData, experienceLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {experienceLevels.map(level => (
                        <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="budgetMin">Minimum Budget ($)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    placeholder="e.g. 1000"
                    value={formData.budgetMin}
                    onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="budgetMax">Maximum Budget ($)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    placeholder="e.g. 5000"
                    value={formData.budgetMax}
                    onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration">Project Duration</Label>
                <Input
                  id="duration"
                  placeholder="e.g. 2 weeks, 1 month"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>

              <div>
                <Label>Milestones (Optional)</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Milestone title"
                    value={newMilestone.title}
                    onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={newMilestone.amount}
                    onChange={(e) => setNewMilestone({ ...newMilestone, amount: e.target.value })}
                    className="w-32"
                  />
                  <Button type="button" onClick={handleAddMilestone}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <span>{milestone.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${milestone.amount}</span>
                        <button onClick={() => handleRemoveMilestone(milestone.id)}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label htmlFor="locationType">Location Type</Label>
                <Select
                  value={formData.locationType}
                  onValueChange={(value) => setFormData({ ...formData, locationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locationTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="visibility">Project Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Visible to all freelancers</SelectItem>
                    <SelectItem value="private">Private - Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-canvas rounded-lg">
                <h4 className="font-medium mb-2">Project Summary</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-ink-4">Title:</span> {formData.title}</p>
                  <p><span className="text-ink-4">Category:</span> {formData.category}</p>
                  <p><span className="text-ink-4">Budget:</span> ${formData.budgetMin} - ${formData.budgetMax} ({formData.budgetType})</p>
                  <p><span className="text-ink-4">Skills:</span> {skills.join(', ') || 'None'}</p>
                </div>
              </div>
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {step > 1 ? (
              <Button variant="outline" onClick={prevStep}>
                Previous
              </Button>
            ) : (
              <div />
            )}
            
            {step < 3 ? (
              <Button onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Post Project
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
