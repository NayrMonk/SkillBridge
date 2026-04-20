import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Briefcase,
  Clock,
  MapPin,
  Users,
  Star,
  Flame,
  Rocket,
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  Calendar,
  Globe,
  Share2,
  Flag
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export const ProjectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applicationData, setApplicationData] = useState({
    coverLetter: '',
    proposedBudget: '',
    proposedDuration: ''
  });
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      setIsLoading(true);
      const response = await api.getProject(id!);
      setProject(response.project);
    } catch (error) {
      console.error('Failed to fetch project:', error);
      toast.error('Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!applicationData.coverLetter.trim()) {
      toast.error('Please write a cover letter');
      return;
    }

    try {
      setIsApplying(true);
      await api.applyToProject({
        projectId: id!,
        coverLetter: applicationData.coverLetter,
        proposedBudget: applicationData.proposedBudget ? parseFloat(applicationData.proposedBudget) : undefined,
        proposedDuration: applicationData.proposedDuration ? parseInt(applicationData.proposedDuration) : undefined
      });
      toast.success('Application submitted successfully!');
      setShowApplyDialog(false);
      fetchProject();
    } catch (error: any) {
      console.error('Apply error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit application');
    } finally {
      setIsApplying(false);
    }
  };

  const getPromotionBadge = (tier: string) => {
    switch (tier) {
      case 'super_hot':
        return (
          <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white">
            <Rocket className="h-3 w-3 mr-1" />
            Super Hot
          </Badge>
        );
      case 'hot':
        return (
          <Badge className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
            <Flame className="h-3 w-3 mr-1" />
            Hot
          </Badge>
        );
      default:
        return null;
    }
  };

  const getExperienceBadge = (level: string) => {
    switch (level) {
      case 'entry':
        return <Badge variant="secondary">Entry Level</Badge>;
      case 'intermediate':
        return <Badge>Intermediate</Badge>;
      case 'expert':
        return <Badge className="bg-purple-500">Expert</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-green-500">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-32 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 text-center py-16">
          <Briefcase className="h-16 w-16 text-ink-4 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-ink-4 mb-4">
            The project you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === project.client_id;
  const hasApplied = project.userApplication != null;
  const canApply = isAuthenticated && user?.role === 'freelancer' && !isOwner && project.status === 'open' && !hasApplied;

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/projects')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {getPromotionBadge(project.promotion_tier)}
                {getExperienceBadge(project.experience_level)}
                {getStatusBadge(project.status)}
              </div>
              <h1 className="text-3xl font-bold mb-4">{project.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-4">
                <span>Posted {formatDistanceToNow(new Date(project.created_at))} ago</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {project.location_type === 'remote' ? 'Remote' : project.location}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {project.application_count} applications
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {project.views} views
                </span>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Project Description</h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{project.description}</p>
              </div>
            </div>

            {/* Skills Required */}
            {project.skills && project.skills.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Skills Required</h2>
                <div className="flex flex-wrap gap-2">
                  {project.skills.map((skill: any) => (
                    <Badge key={skill.id} variant="secondary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones */}
            {project.milestones && project.milestones.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Project Milestones</h2>
                <div className="space-y-3">
                  {project.milestones.map((milestone: any, index: number) => (
                    <div key={milestone.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{milestone.title}</h4>
                        {milestone.description && (
                          <p className="text-sm text-ink-4">{milestone.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${milestone.amount?.toLocaleString()}</p>
                        {milestone.due_date && (
                          <p className="text-sm text-ink-4">
                            Due {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Required Tests */}
            {project.requiredTests && project.requiredTests.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Required Tests</h2>
                <div className="space-y-3">
                  {project.requiredTests.map((test: any) => (
                    <div key={test.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <CheckCircle className="h-5 w-5 text-brand" />
                      <div>
                        <h4 className="font-medium">{test.title}</h4>
                        <p className="text-sm text-ink-4">
                          {test.duration_minutes} minutes • Passing score: {test.passing_score}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Activity</h2>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-2xl font-bold">{project.proposals_count || 0}</p>
                  <p className="text-sm text-ink-4">Proposals</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{project.interviewing_count || 0}</p>
                  <p className="text-sm text-ink-4">Interviewing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{project.invites_sent || 0}</p>
                  <p className="text-sm text-ink-4">Invites sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{project.unanswered_invites || 0}</p>
                  <p className="text-sm text-ink-4">Unanswered invites</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Apply Card */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-6">
                  <p className="text-sm text-ink-4 mb-1">Budget</p>
                  <p className="text-2xl font-bold">
                    ${project.budget_min?.toLocaleString()} - ${project.budget_max?.toLocaleString()}
                  </p>
                  <p className="text-sm text-ink-4 capitalize">
                    {project.budget_type} price
                  </p>
                </div>

                {project.deadline && (
                  <div className="mb-6">
                    <p className="text-sm text-ink-4 mb-1">Deadline</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(project.deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}

                {project.duration && (
                  <div className="mb-6">
                    <p className="text-sm text-ink-4 mb-1">Duration</p>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {project.duration}
                    </p>
                  </div>
                )}

                {canApply ? (
                  <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full">Apply Now</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Apply to Project</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="coverLetter">Cover Letter *</Label>
                          <Textarea
                            id="coverLetter"
                            placeholder="Introduce yourself and explain why you're a good fit for this project..."
                            value={applicationData.coverLetter}
                            onChange={(e) => setApplicationData({ ...applicationData, coverLetter: e.target.value })}
                            rows={6}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="proposedBudget">Proposed Budget ($)</Label>
                            <Input
                              id="proposedBudget"
                              type="number"
                              placeholder="Optional"
                              value={applicationData.proposedBudget}
                              onChange={(e) => setApplicationData({ ...applicationData, proposedBudget: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="proposedDuration">Duration (days)</Label>
                            <Input
                              id="proposedDuration"
                              type="number"
                              placeholder="Optional"
                              value={applicationData.proposedDuration}
                              onChange={(e) => setApplicationData({ ...applicationData, proposedDuration: e.target.value })}
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={handleApply} 
                          className="w-full"
                          disabled={isApplying}
                        >
                          {isApplying ? 'Submitting...' : 'Submit Application'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : hasApplied ? (
                  <Button className="w-full" disabled>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Applied
                  </Button>
                ) : !isAuthenticated ? (
                  <Button className="w-full" onClick={() => navigate('/login')}>
                    Log in to Apply
                  </Button>
                ) : user?.role === 'client' ? (
                  <Button className="w-full" disabled>
                    Clients can't apply
                  </Button>
                ) : (
                  <Button className="w-full" disabled>
                    Not available
                  </Button>
                )}

                {isOwner && (
                  <Button 
                    className="w-full mt-2" 
                    variant="outline"
                    onClick={() => navigate(`/dashboard/applications?project=${project.id}`)}
                  >
                    View Applications
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle>About the Client</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-brand flex items-center justify-center text-white font-medium text-lg">
                    {project.client_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium">{project.client_name}</h4>
                    <div className="flex items-center gap-1 text-sm text-ink-4">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{project.client_rating || '0.0'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-4">Member since</span>
                    <span>Jan 2024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-4">Total spent</span>
                    <span>${project.client_total_spent?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-4">Jobs posted</span>
                    <span>{project.client_jobs_completed || 0}</span>
                  </div>
                </div>

                {!isOwner && isAuthenticated && (
                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => navigate(`/dashboard/messages/${project.client_id}`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Contact Client
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Share & Report */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
              <Button variant="outline" className="flex-1" size="sm">
                <Flag className="mr-2 h-4 w-4" />
                Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
