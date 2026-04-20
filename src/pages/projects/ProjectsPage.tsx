import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Filter, 
  Flame, 
  Rocket, 
  DollarSign, 
  Users,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  X,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

const categories = [
  'All',
  'Web Development',
  'AI/ML',
  'Design',
  'Writing',
  'Video Editing'
];

const experienceLevels = [
  { value: 'all', label: 'All Levels' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'expert', label: 'Expert' }
];

const budgetTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' }
];

export const ProjectsPage = () => {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  });
  
  // Filters
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || 'All',
    experienceLevel: 'all',
    budgetType: 'all',
    minBudget: '',
    maxBudget: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        status: 'open'
      };

      if (filters.search) params.search = filters.search;
      if (filters.category && filters.category !== 'All') params.category = filters.category;
      if (filters.experienceLevel && filters.experienceLevel !== 'all') {
        params.experience_level = filters.experienceLevel;
      }
      if (filters.budgetType && filters.budgetType !== 'all') {
        params.budget_type = filters.budgetType;
      }
      if (filters.minBudget) params.budget_min = filters.minBudget;
      if (filters.maxBudget) params.budget_max = filters.maxBudget;

      const response = await api.getProjects(params);
      setProjects(response.projects);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchProjects();
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'All',
      experienceLevel: 'all',
      budgetType: 'all',
      minBudget: '',
      maxBudget: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getPromotionBadge = (tier: string) => {
    if (tier === 'super_hot') return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-red-400 text-white">⭐ Featured</span>;
    if (tier === 'hot') return <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#FF4500] text-white">🔥 Hot</span>;
    return null;
  };

  const getExperienceBadge = (level: string) => {
    switch (level) {
      case 'entry':
        return <Badge variant="secondary">Entry</Badge>;
      case 'intermediate':
        return <Badge variant="default">Intermediate</Badge>;
      case 'expert':
        return <Badge className="bg-purple-500">Expert</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-canvas py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Find Work</h1>
          <p className="text-ink-4">
            Browse {pagination.total.toLocaleString()} open projects
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-4" />
              <Input
                type="text"
                placeholder="Search projects by title, description, or skills..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </form>

          {/* Filter Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 rounded-xl bg-white border border-ink-6 sticky top-[76px]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Filters</h3>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select 
                    value={filters.category} 
                    onValueChange={(value) => handleFilterChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Experience Level</label>
                  <Select 
                    value={filters.experienceLevel} 
                    onValueChange={(value) => handleFilterChange('experienceLevel', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {experienceLevels.map(level => (
                        <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Budget Type</label>
                  <Select 
                    value={filters.budgetType} 
                    onValueChange={(value) => handleFilterChange('budgetType', value)}
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
                  <label className="text-sm font-medium mb-2 block">Budget Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min $"
                      value={filters.minBudget}
                      onChange={(e) => handleFilterChange('minBudget', e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Max $"
                      value={filters.maxBudget}
                      onChange={(e) => handleFilterChange('maxBudget', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Active Filters */}
          {(filters.category !== 'All' || filters.experienceLevel !== 'all' || filters.budgetType !== 'all' || filters.minBudget || filters.maxBudget) && (
            <div className="flex flex-wrap gap-2">
              {filters.category !== 'All' && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => handleFilterChange('category', 'All')}>
                  {filters.category} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {filters.experienceLevel !== 'all' && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => handleFilterChange('experienceLevel', 'all')}>
                  {experienceLevels.find(l => l.value === filters.experienceLevel)?.label} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {filters.budgetType !== 'all' && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => handleFilterChange('budgetType', 'all')}>
                  {budgetTypes.find(t => t.value === filters.budgetType)?.label} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
              {(filters.minBudget || filters.maxBudget) && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => { handleFilterChange('minBudget', ''); handleFilterChange('maxBudget', ''); }}>
                  ${filters.minBudget || '0'} - ${filters.maxBudget || '∞'} <X className="ml-1 h-3 w-3" />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <Briefcase className="h-12 w-12 text-ink-5 mx-auto mb-4" />
            <h3 className="text-xl font-display text-ink mb-2">No projects found</h3>
            <p className="text-ink-4 text-sm mb-4">
              Try adjusting your filters or search query
            </p>
            <Button onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/projects/${project.id}`}>
                    <div className={`group bg-white rounded-xl border border-ink-6 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full flex flex-col ${project.promotion_tier === 'super_hot' || project.promotion_tier === 'featured' ? 'border-t-[3px] border-t-amber-400' : project.promotion_tier === 'hot' ? 'border-t-[3px] border-t-[#FF4500]' : ''}`}>
                      <div className="p-5 flex-1">
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {getPromotionBadge(project.promotion_tier)}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-4 bg-canvas rounded-full px-2.5 py-1">{project.category}</span>
                          </div>
                          <span className="text-xs text-ink-4 shrink-0">
                            {formatDistanceToNow(new Date(project.created_at))} ago
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-ink mb-2 group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                          {project.title}
                        </h3>

                        {/* Description */}
                        <p className="text-ink-4 text-sm mb-4 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>

                        {/* Skills */}
                        {project.skills && project.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {project.skills.slice(0, 4).map((skill: any) => (
                              <span key={skill.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent2-soft text-brand-dark">
                                {skill.name}
                              </span>
                            ))}
                            {project.skills.length > 4 && (
                              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-canvas text-ink-4">
                                +{project.skills.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-4 border-t border-ink-6 bg-canvas/50">
                        <div className="flex items-center justify-between">
                          <span className="text-brand font-bold text-base">
                            ${Number(project.budget_min || 0).toLocaleString()}
                            {project.budget_max && project.budget_max !== project.budget_min && `–$${Number(project.budget_max).toLocaleString()}`}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-ink-4">
                            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{project.application_count || 0}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{project.duration || '—'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-extrabold shrink-0">
                            {project.client_name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <span className="text-xs font-medium text-ink-3 truncate">{project.client_name}</span>
                          {project.client_is_verified && <span className="text-[10px] text-success font-bold">✓ Verified</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                Previous
                </Button>
                <span className="text-sm text-ink-4">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
