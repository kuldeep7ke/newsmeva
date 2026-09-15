export const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', className: 'urgent' },
  high: { label: 'High', className: 'high' },
  medium: { label: 'Medium', className: 'medium' },
  low: { label: 'Low', className: 'low' }
};

export const STATUS_CONFIG = {
  draft: { label: 'Draft', order: 0 },
  script_writing: { label: 'Script Writing', order: 1 },
  footage_collection: { label: 'Footage Collection', order: 2 },
  waiting_confirmation: { label: 'Waiting Confirmation', order: 3 },
  correction_required: { label: 'Correction Required', order: 4 },
  approved: { label: 'Approved', order: 5 },
  editor_assigned: { label: 'Editor Assigned', order: 6 },
  teleprompter_ready: { label: 'Teleprompter Ready', order: 7 },
  prompting: { label: 'Prompting', order: 8 },
  recording_done: { label: 'Recording Done', order: 9 },
  editing: { label: 'Editing', order: 10 },
  uploading: { label: 'Uploading', order: 11 },
  published: { label: 'Published', order: 12 },
  under_review: { label: 'Under Review', order: 13 },
  completed: { label: 'Completed', order: 14 },
  cancelled: { label: 'Cancelled', order: 15 }
};

export const STATUS_STEPS = {
  draft: ['script_writing', 'footage_collection'],
  script_writing: ['waiting_confirmation'],
  footage_collection: ['waiting_confirmation'],
  waiting_confirmation: ['approved', 'correction_required'],
  correction_required: ['script_writing', 'footage_collection'],
  approved: ['editor_assigned'],
  editor_assigned: ['teleprompter_ready'],
  teleprompter_ready: ['prompting'],
  prompting: ['recording_done'],
  recording_done: ['editing'],
  editing: ['uploading'],
  uploading: ['published'],
  published: ['under_review', 'completed'],
  under_review: ['completed', 'correction_required'],
  completed: [],
  cancelled: []
};

export const TASK_TYPES = [
  { value: 'news', label: 'News' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'special_report', label: 'Special Report' },
  { value: 'story', label: 'Story' },
  { value: 'press', label: 'Press' },
  { value: 'ground_report', label: 'Ground Report' },
  { value: 'live', label: 'Live' },
  { value: 'event', label: 'Event' }
];

export const SEED_CATEGORIES = [
  { name: 'Breaking News', icon: 'zap', color: '#EF4444', order: 1 },
  { name: 'Politics', icon: 'landmark', color: '#3B82F6', order: 2 },
  { name: 'Business', icon: 'briefcase', color: '#8B5CF6', order: 3 },
  { name: 'Sports', icon: 'trophy', color: '#22C55E', order: 4 },
  { name: 'Entertainment', icon: 'clapperboard', color: '#EC4899', order: 5 },
  { name: 'Technology', icon: 'cpu', color: '#14B8A6', order: 6 },
  { name: 'Education', icon: 'graduation-cap', color: '#06B6D4', order: 7 },
  { name: 'Health', icon: 'heart-pulse', color: '#F59E0B', order: 8 },
  { name: 'Local', icon: 'map-pin', color: '#6366F1', order: 9 },
  { name: 'International', icon: 'globe', color: '#F97316', order: 10 }
];

const templates = {
  'Breaking News': ['Breaking news alert', 'Live coverage setup', 'Developing story update', 'Flash report', 'Urgent bulletin'],
  'Politics': ['Political press conference', 'Election coverage', 'Policy analysis story', 'Government announcement', 'Interview: political figure'],
  'Business': ['Market report', 'Company earnings story', 'Industry analysis', 'Startup feature', 'Economic indicator report'],
  'Sports': ['Match preview', 'Post-match analysis', 'Player profile', 'Tournament coverage', 'Sports event live'],
  'Entertainment': ['Celebrity interview', 'Movie review', 'Music release feature', 'Festival coverage', 'Award show report'],
  'Technology': ['Tech product review', 'Startup spotlight', 'AI/Tech trend story', 'App launch feature', 'Digital transformation'],
  'Education': ['Education reform story', 'Student achievement feature', 'University news', 'Learning initiative', 'Exam results report'],
  'Health': ['Health awareness story', 'Medical breakthrough', 'Public health report', 'Wellness feature', 'Hospital/clinic news'],
  'Local': ['Local event coverage', 'Community story', 'Municipal news', 'Local hero feature', 'Regional development'],
  'International': ['World news roundup', 'International crisis', 'Diplomatic story', 'Global event coverage', 'Foreign affairs report']
};

export function buildSeedTemplates(categoryRows) {
  return categoryRows.flatMap((category) =>
    (templates[category.name] || []).map((title, index) => ({
      categoryId: category.id,
      title,
      description: `Smart template: ${title.toLowerCase()}.`,
      priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
      order: index + 1
    }))
  );
}
