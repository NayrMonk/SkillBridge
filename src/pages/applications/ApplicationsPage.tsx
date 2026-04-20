import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Briefcase,
  Clock,
  DollarSign,
  ArrowRight,
  X,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const statusTabs = [
  { value: 'all', label: 'All', count: 0 },
  { value: 'pending', label: 'Pending', count: 0 },
  { value: 'shortlisted', label: 'Shortlisted', count: 0 },
  { value: 'hired', label: 'Hired', count: 0 },
  { value: 'rejected', label: 'Rejected', count: 0 }
];

export const ApplicationsPage = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [activeTab]);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      const response = await api.getMyApplications(params);
      setApplications(response.applications);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async (id: string) => {
    try {
      setWithdrawingId(id);
      await api.withdrawApplication(id);
      toast.success('Application withdrawn successfully');
      fetchApplications();
    } catch (error) {
      console.error('Withdraw error:', error);
      toast.error('Failed to withdraw application');
    } finally {
      setWithdrawingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'shortlisted':
        return (
          <Badge className="bg-blue-500 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Shortlisted
          </Badge>
        );
      case 'hired':
        return (
          <Badge className="bg-green-500 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Hired
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <X className="h-3 w-3" />
            Not Selected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredApplications = activeTab === 'all' 
    ? applications 
    : applications.filter(app => app.status === activeTab);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Applications</h1>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Applications</h1>
          <p className="text-ink-4 mt-1">
            Track your job applications and their status
          </p>
        </div>
        <Button onClick={() => navigate('/projects')}>
          <Briefcase className="mr-2 h-4 w-4" />
          Find More Projects
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {statusTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              {tab.value !== 'all' && (
                <span className="ml-2 text-xs text-ink-4">
                  ({applications.filter(a => a.status === tab.value).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredApplications.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="h-16 w-16 text-ink-4 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No applications found</h3>
              <p className="text-ink-4 mb-4">
                {activeTab === 'all' 
                  ? "You haven't applied to any projects yet."
                  : `No ${activeTab} applications found.`}
              </p>
              <Button onClick={() => navigate('/projects')}>
                Browse Projects
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplications.map((application) => (
                <Card key={application.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 
                            className="text-lg font-semibold cursor-pointer hover:text-brand"
                            onClick={() => navigate(`/projects/${application.project_id}`)}
                          >
                            {application.project_title}
                          </h3>
                          {getStatusBadge(application.status)}
                        </div>
                        
                        <p className="text-sm text-ink-4 mb-4">
                          {application.project_category} • Applied {formatDistanceToNow(new Date(application.created_at))} ago
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-500" />
                            <span className="font-medium">
                              ${application.budget_min?.toLocaleString()} - ${application.budget_max?.toLocaleString()}
                            </span>
                          </div>
                          {application.proposed_budget && (
                            <div className="flex items-center gap-1">
                              <span className="text-ink-4">Your bid:</span>
                              <span className="font-medium">${application.proposed_budget.toLocaleString()}</span>
                            </div>
                          )}
                          {application.proposed_duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-ink-4" />
                              <span>{application.proposed_duration} days</span>
                            </div>
                          )}
                        </div>

                        {application.client_notes && (
                          <div className="mt-4 p-3 bg-canvas rounded-lg">
                            <p className="text-sm text-ink-4">
                              <span className="font-medium">Client note:</span> {application.client_notes}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/projects/${application.project_id}`)}
                        >
                          View Project
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        
                        {application.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleWithdraw(application.id)}
                            disabled={withdrawingId === application.id}
                          >
                            {withdrawingId === application.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <X className="mr-2 h-4 w-4" />
                            )}
                            Withdraw
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
