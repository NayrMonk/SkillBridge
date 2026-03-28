import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface Question {
  id: string;
  question_type: 'mcq' | 'coding' | 'written';
  question_text: string;
  options?: string[];
  points: number;
}

export const TakeTestPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [testData, setTestData] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    startTest();
  }, [templateId]);

  useEffect(() => {
    if (timeRemaining > 0 && !showResults) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining, showResults]);

  const startTest = async () => {
    try {
      setIsLoading(true);
      const response = await api.startTest(templateId!);
      setTestData(response);
      setAttemptId(response.attempt.id);
      setQuestions(response.questions);
      setTimeRemaining(response.template.durationMinutes * 60);
    } catch (error: any) {
      console.error('Failed to start test:', error);
      toast.error(error.response?.data?.error || 'Failed to start test');
      navigate('/dashboard/tests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const question = questions[currentQuestionIndex];
    setAnswers(prev => ({ ...prev, [question.id]: answer }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));
      
      const response = await api.submitTest(attemptId, formattedAnswers);
      setResults(response.result);
      setShowResults(true);
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (showResults && results) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className={`h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              results.passed ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {results.passed ? (
                <CheckCircle className="h-10 w-10 text-green-500" />
              ) : (
                <XCircle className="h-10 w-10 text-red-500" />
              )}
            </div>
            
            <h1 className="text-3xl font-bold mb-2">
              {results.passed ? 'Congratulations!' : 'Test Completed'}
            </h1>
            <p className="text-ink-4 mb-6">
              {results.passed 
                ? 'You passed the test and earned a verified skill badge!' 
                : 'Keep practicing and try again to earn your badge.'}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-canvas rounded-lg">
                <p className="text-2xl font-bold">{results.score}</p>
                <p className="text-sm text-ink-4">Points</p>
              </div>
              <div className="p-4 bg-canvas rounded-lg">
                <p className="text-2xl font-bold">{results.maxScore}</p>
                <p className="text-sm text-ink-4">Max Points</p>
              </div>
              <div className="p-4 bg-canvas rounded-lg">
                <p className="text-2xl font-bold">{results.percentage}%</p>
                <p className="text-sm text-ink-4">Score</p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate('/dashboard/tests')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Tests
              </Button>
              {!results.passed && (
                <Button onClick={() => window.location.reload()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retake Test
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{testData?.template?.title}</h1>
          <p className="text-ink-4">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          timeRemaining < 60 ? 'bg-red-500/10 text-red-500' : 'bg-canvas'
        }`}>
          <Clock className="h-5 w-5" />
          <span className="font-mono text-lg">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Progress */}
      <Progress value={progress} className="h-2" />

      {/* Question Card */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary">
                {currentQuestion.question_type === 'mcq' && 'Multiple Choice'}
                {currentQuestion.question_type === 'coding' && 'Coding'}
                {currentQuestion.question_type === 'written' && 'Written'}
              </Badge>
              <span className="text-sm text-ink-4">
                {currentQuestion.points} points
              </span>
            </div>
            <h2 className="text-lg font-medium">{currentQuestion.question_text}</h2>
          </div>

          {/* Answer Input */}
          {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={handleAnswer}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-canvas/50 cursor-pointer">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {(currentQuestion.question_type === 'coding' || currentQuestion.question_type === 'written') && (
            <Textarea
              placeholder={currentQuestion.question_type === 'coding' 
                ? 'Write your code here...' 
                : 'Write your answer here...'}
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              rows={8}
              className="font-mono"
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length < questions.length}
            >
              {isSubmitting ? (
                <>Submitting...</>
              ) : (
                <>
                  Submit Test
                  <CheckCircle className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Question Navigator */}
      <div className="flex flex-wrap gap-2 justify-center">
        {questions.map((q, index) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(index)}
            className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
              index === currentQuestionIndex
                ? 'bg-brand text-brand-foreground'
                : answers[q.id]
                ? 'bg-green-500/10 text-green-600'
                : 'bg-canvas text-ink-4 hover:bg-canvas/80'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};
