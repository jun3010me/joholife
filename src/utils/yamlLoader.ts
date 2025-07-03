import * as yaml from 'js-yaml';
import type { QuestionSet, Question } from '../types/question';

export async function loadQuestionSet(setId: string): Promise<QuestionSet | null> {
  try {
    const response = await fetch(`/questions/${setId}/questions.yaml`);
    if (!response.ok) {
      throw new Error(`Failed to load question set: ${response.status}`);
    }
    
    const yamlContent = await response.text();
    const data = yaml.load(yamlContent) as QuestionSet;
    
    // Validate and transform the data
    return validateQuestionSet(data);
  } catch (error) {
    console.error(`Error loading question set ${setId}:`, error);
    return null;
  }
}

export async function loadAvailableQuestionSets(): Promise<QuestionSet[]> {
  try {
    const response = await fetch('/questions/index.yaml');
    if (!response.ok) {
      throw new Error(`Failed to load question sets index: ${response.status}`);
    }
    
    const yamlContent = await response.text();
    const data = yaml.load(yamlContent) as { questionSets: string[] };
    
    const questionSets: QuestionSet[] = [];
    
    // Load each question set
    for (const setId of data.questionSets) {
      const questionSet = await loadQuestionSet(setId);
      if (questionSet) {
        questionSets.push(questionSet);
      }
    }
    
    return questionSets;
  } catch (error) {
    console.error('Error loading available question sets:', error);
    return [];
  }
}

function validateQuestionSet(data: any): QuestionSet {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid question set data');
  }
  
  const {
    id,
    title,
    description,
    icon,
    difficulty,
    estimatedTime,
    questions,
    tags,
    category
  } = data;
  
  if (!id || !title || !description || !questions || !Array.isArray(questions)) {
    throw new Error('Missing required fields in question set');
  }
  
  const validatedQuestions: Question[] = questions.map(validateQuestion);
  
  return {
    id,
    title,
    description,
    icon: icon || '📝',
    difficulty: difficulty || 'medium',
    estimatedTime: estimatedTime || 10,
    questions: validatedQuestions,
    tags: tags || [],
    category: category || 'general'
  };
}

function validateQuestion(data: any): Question {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid question data');
  }
  
  const {
    id,
    type,
    title,
    description,
    options,
    correctAnswer,
    explanation,
    difficulty,
    tags,
    points,
    hint,
    imageUrl
  } = data;
  
  if (!id || !type || !title || !description || !explanation) {
    throw new Error('Missing required fields in question');
  }
  
  if (type === 'multiple-choice' || type === 'single-choice') {
    if (!options || !Array.isArray(options)) {
      throw new Error('Options are required for choice questions');
    }
  }
  
  return {
    id,
    type,
    title,
    description,
    options: options || [],
    correctAnswer,
    explanation,
    difficulty: difficulty || 'medium',
    tags: tags || [],
    points: points || 1,
    hint,
    imageUrl
  };
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getRandomQuestions(questions: Question[], count: number): Question[] {
  if (questions.length <= count) {
    return shuffleArray(questions);
  }
  
  const shuffled = shuffleArray(questions);
  return shuffled.slice(0, count);
}