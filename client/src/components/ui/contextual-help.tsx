import React, { useState, useCallback } from 'react';
import { HelpCircle, Loader2, Brain, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface HelpContext {
  page: string;
  section: string;
  field?: string;
  userRole?: string;
  currentData?: any;
}

interface AIHelpResponse {
  insights: string;
  tips: string[];
  bestPractices: string[];
  relatedConcepts: string[];
}

interface ContextualHelpProps {
  context: HelpContext;
  title?: string;
  className?: string;
  variant?: 'icon' | 'button' | 'inline';
  trigger?: 'hover' | 'click';
}

export function ContextualHelp({ 
  context, 
  title, 
  className = "",
  variant = 'icon',
  trigger = 'click'
}: ContextualHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [helpContent, setHelpContent] = useState<AIHelpResponse | null>(null);

  const generateHelpMutation = useMutation({
    mutationFn: async (helpContext: HelpContext) => {
      const response = await apiRequest('POST', '/api/help/generate', helpContext);
      return await response.json();
    },
    onSuccess: (data: AIHelpResponse) => {
      setHelpContent(data);
    }
  });

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    // Generate help content when opening
    if (!helpContent && !generateHelpMutation.isPending) {
      generateHelpMutation.mutate(context);
    }
  }, [context, helpContent, generateHelpMutation]);

  const renderTrigger = () => {
    switch (variant) {
      case 'button':
        return (
          <Button
            variant="outline"
            size="sm"
            className={`h-8 ${className}`}
            onClick={handleOpen}
          >
            <Brain className="h-4 w-4 mr-2" />
            Help
          </Button>
        );
      case 'inline':
        return (
          <span 
            className={`inline-flex items-center text-blue-600 hover:text-blue-800 cursor-pointer ${className}`}
            onClick={handleOpen}
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            {title || 'Help'}
          </span>
        );
      default:
        return (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 text-gray-400 hover:text-blue-600 ${className}`}
            onClick={handleOpen}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        );
    }
  };

  const renderContent = () => {
    if (generateHelpMutation.isPending) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Generating insights...</span>
        </div>
      );
    }

    if (generateHelpMutation.isError) {
      return (
        <div className="p-4 text-sm text-red-600">
          Unable to generate help content. Please try again.
        </div>
      );
    }

    if (!helpContent) {
      return (
        <div className="p-4 text-sm text-gray-600">
          Click to get AI-powered insights for this field.
        </div>
      );
    }

    return (
      <div className="max-w-sm p-4 space-y-3">
        {/* AI Insights */}
        <div>
          <div className="flex items-center mb-2">
            <Brain className="h-4 w-4 mr-2 text-blue-600" />
            <span className="font-medium text-sm">AI Insights</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {helpContent.insights}
          </p>
        </div>

        {/* Quick Tips */}
        {helpContent.tips && helpContent.tips.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 text-gray-900">Quick Tips</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {helpContent.tips.map((tip, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Best Practices */}
        {helpContent.bestPractices && helpContent.bestPractices.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 text-gray-900">Best Practices</h4>
            <div className="flex flex-wrap gap-1">
              {helpContent.bestPractices.map((practice, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {practice}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Related Concepts */}
        {helpContent.relatedConcepts && helpContent.relatedConcepts.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 text-gray-900">Related</h4>
            <div className="flex flex-wrap gap-1">
              {helpContent.relatedConcepts.map((concept, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {concept}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {renderTrigger()}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            {title || 'AI-Powered Help'}
          </DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

// Specialized help components for common contexts
export function FieldHelp({ 
  field, 
  page, 
  section, 
  currentData,
  className = "",
  variant = 'icon' as const,
  trigger = 'click' as const
}: {
  field: string;
  page: string;
  section: string;
  currentData?: any;
  className?: string;
  variant?: 'icon' | 'button' | 'inline';
  trigger?: 'hover' | 'click';
}) {
  const context: HelpContext = {
    page,
    section,
    field,
    currentData
  };

  return (
    <ContextualHelp 
      context={context} 
      title={`Help with ${field}`}
      className={className}
      variant={variant}
      trigger={trigger}
    />
  );
}

export function PageHelp({ 
  page, 
  section,
  className = "",
  variant = 'button' as const,
  trigger = 'click' as const
}: {
  page: string;
  section: string;
  className?: string;
  variant?: 'icon' | 'button' | 'inline';
  trigger?: 'hover' | 'click';
}) {
  const context: HelpContext = {
    page,
    section
  };

  return (
    <ContextualHelp 
      context={context} 
      title={`Help with ${section}`}
      className={className}
      variant={variant}
      trigger={trigger}
    />
  );
}