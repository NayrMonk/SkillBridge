import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TestTube,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Award,
  BookOpen,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export const TestsPage = () => {
  const navigate = useNavigate();
  const [testTemplates, setTestTemplates] = useState<any[]>([]);
  const [myAttempts, setMyAttempts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [templatesRes, attemptsRes] = await Promise.all([
        api.getTestTemplates(),
        api.getMyTestAttempts()
      ]);
      setTestTemplates(templatesRes.templates);
      setMyAttempts(attemptsRes.attempts);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
      toast.error('Failed to load tests');
    } finally {
      setIsLoading(false);
    }
  };

  const getAttemptForTest = (testId: string) => {
    return myAttempts.find(a => a.test_template_id === testId && a.status === 'completed');
  };

  const getStatusBadge = (attempt: any) => {
    if (!attempt) return <Badge variant="secondary">Not Taken</Badge>;
    
    if (attempt.passed) {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Passed
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Skill Tests</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skill Tests</h1>
        <p className="text-ink-4 mt-1">
          Verify your skills and stand out to clients
        </p>
      </div>

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">
            <BookOpen className="mr-2 h-4 w-4" />
            Available Tests
          </TabsTrigger>
          <TabsTrigger value="completed">
            <Award className="mr-2 h-4 w-4" />
            My Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testTemplates.map((test) => {
              const attempt = getAttemptForTest(test.id);
              
              return (
                <Card key={test.id} className={attempt?.passed ? 'border-green-500/50' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-12 w-12 rounded-lg bg-brand/10 flex items-center justify-center">
                        <TestTube className="h-6 w-6 text-brand" />
                      </div>
                      {getStatusBadge(attempt)}
                    </div>

                    <h3 className="text-lg font-semibold mb-2">{test.title}</h3>
                    <p className="text-sm text-ink-4 mb-4 line-clamp-2">
                      {test.description || 'Test your skills in this area'}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-ink-4 mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {test.duration_minutes} minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-4 w-4" />
                        {test.passing_score}% to pass
                      </span>
                    </div>

                    {attempt?.passed ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Your Score</span>
                          <span className="font-medium">{attempt.percentage}%</span>
                        </div>
                        <Progress value={attempt.percentage} className="h-2" />
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Passed on {format(new Date(attempt.completed_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    ) : attempt ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Your Score</span>
                          <span className="font-medium">{attempt.percentage}%</span>
                        </div>
                        <Progress value={attempt.percentage} className="h-2" />
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => navigate(`/dashboard/tests/take/${test.id}`)}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retake Test
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => navigate(`/dashboard/tests/take/${test.id}`)}
                      >
                        Start Test
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {myAttempts.length === 0 ? (
            <div className="text-center py-16">
              <TestTube className="h-16 w-16 text-ink-4 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tests taken yet</h3>
              <p className="text-ink-4 mb-4">
                Take skill tests to verify your expertise
              </p>
              <Button onClick={() => navigate('/dashboard/tests')}>
                Browse Tests
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {myAttempts.map((attempt) => (
                <Card key={attempt.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          attempt.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}>
                          {attempt.passed ? (
                            <CheckCircle className="h-6 w-6 text-green-500" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{attempt.test_title}</h3>
                          <p className="text-sm text-ink-4">
                            {attempt.test_category} • Completed on {format(new Date(attempt.completed_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {attempt.percentage}%
                        </p>
                        <p className="text-sm text-ink-4">
                          {attempt.score}/{attempt.max_score} points
                        </p>
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
