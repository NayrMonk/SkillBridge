import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Globe,
  Calendar,
  Star,
  Briefcase,
  Edit,
  ExternalLink,
  Github,
  Linkedin,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const ProfilePage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await api.getProfile();
      setProfile(response.profile);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-4">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cover & Profile Header */}
      <Card>
        <div className="h-32 bg-gradient-to-r from-brand to-brand-light rounded-t-lg" />
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
            <div className="h-32 w-32 rounded-full border-4 border-background bg-brand flex items-center justify-center text-white text-4xl font-bold">
              {profile.display_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{profile.display_name}</h1>
                {profile.is_verified && (
                  <Badge className="bg-blue-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-ink-4">{profile.headline || 'No headline'}</p>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-ink-4">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </span>
                )}
                {profile.timezone && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {profile.timezone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {format(new Date(profile.created_at), 'MMM yyyy')}
                </span>
              </div>
            </div>
            <Button onClick={() => navigate('/dashboard/profile/edit')}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{profile.rating || '0.0'}</span>
                  <span className="text-ink-4">({profile.review_count || 0} reviews)</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-4">Jobs Completed</span>
                <span className="font-medium">{profile.jobs_completed || 0}</span>
              </div>
              {user?.role === 'freelancer' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-4">Total Earnings</span>
                    <span className="font-medium">${profile.total_earnings?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-4">Hourly Rate</span>
                    <span className="font-medium">
                      {profile.hourly_rate ? `$${profile.hourly_rate}/hr` : 'Not set'}
                    </span>
                  </div>
                </>
              )}
              {user?.role === 'client' && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-4">Total Spent</span>
                  <span className="font-medium">${profile.total_spent?.toLocaleString() || '0'}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.skills?.length === 0 ? (
                <p className="text-ink-4 text-sm">No skills added yet</p>
              ) : (
                <div className="space-y-3">
                  {profile.skills?.map((skill: any) => (
                    <div key={skill.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{skill.name}</span>
                        <span className="text-sm text-ink-4">{skill.proficiency}/5</span>
                      </div>
                      <Progress value={(skill.proficiency / 5) * 100} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Links */}
          {(profile.website_url || profile.linkedin_url || profile.github_url) && (
            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:text-brand"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:text-brand"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {profile.github_url && (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:text-brand"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="about">
            <TabsList>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.bio ? (
                    <p className="whitespace-pre-wrap">{profile.bio}</p>
                  ) : (
                    <p className="text-ink-4">No bio added yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="portfolio" className="mt-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Portfolio</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/profile/edit')}>
                    <Edit className="mr-2 h-4 w-4" />
                    Add Project
                  </Button>
                </CardHeader>
                <CardContent>
                  {profile.portfolio?.length === 0 ? (
                    <div className="text-center py-8">
                      <Briefcase className="h-12 w-12 text-ink-4 mx-auto mb-4" />
                      <p className="text-ink-4">No portfolio items yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile.portfolio?.map((item: any) => (
                        <Card key={item.id}>
                          <CardContent className="p-4">
                            <h4 className="font-semibold mb-2">{item.title}</h4>
                            <p className="text-sm text-ink-4 line-clamp-2 mb-3">
                              {item.description}
                            </p>
                            {item.project_url && (
                              <a
                                href={item.project_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-brand hover:underline flex items-center gap-1"
                              >
                                View Project
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reviews</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.reviews?.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="h-12 w-12 text-ink-4 mx-auto mb-4" />
                      <p className="text-ink-4">No reviews yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {profile.reviews?.map((review: any) => (
                        <div key={review.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-medium">
                                {review.reviewer_name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium">{review.reviewer_name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: review.rating }).map((_, i) => (
                                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-ink-4">{review.content}</p>
                          <p className="text-xs text-ink-4 mt-2">
                            {format(new Date(review.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
