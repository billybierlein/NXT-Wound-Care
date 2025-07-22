import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Stethoscope, 
  Send, 
  MessageCircle, 
  Loader2,
  FileText,
  Target,
  BookOpen,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Function to format markdown-style content to HTML
const formatMessageContent = (content: string): string => {
  // Split content into lines for better processing
  let result = content;
  
  // Convert headers
  result = result.replace(/### (.*$)/gm, '<h3 class="text-lg font-semibold text-gray-900 mb-2 mt-4 first:mt-0">$1</h3>');
  result = result.replace(/#### (.*$)/gm, '<h4 class="text-base font-semibold text-gray-800 mb-2 mt-3 first:mt-0">$1</h4>');
  result = result.replace(/## (.*$)/gm, '<h2 class="text-xl font-bold text-gray-900 mb-3 mt-5 first:mt-0">$1</h2>');
  
  // Convert bold text (including nested formatting)
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  
  // Convert italic text
  result = result.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em class="italic">$1</em>');
  
  // Process lists - first convert bullet points and numbered items
  const lines = result.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for bullet points
    if (line.match(/^- (.+)/)) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push(`</${listType}>`);
        processedLines.push('<ul class="mb-3 space-y-1 ml-4">');
        inList = true;
        listType = 'ul';
      }
      const content = line.replace(/^- (.+)/, '$1');
      processedLines.push(`<li class="mb-1">${content}</li>`);
    }
    // Check for sub-bullet points
    else if (line.match(/^  - (.+)/)) {
      const content = line.replace(/^  - (.+)/, '$1');
      processedLines.push(`<li class="mb-1 ml-4">${content}</li>`);
    }
    // Check for numbered lists
    else if (line.match(/^\d+\. (.+)/)) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push(`</${listType}>`);
        processedLines.push('<ol class="mb-3 space-y-1 ml-4 list-decimal">');
        inList = true;
        listType = 'ol';
      }
      const content = line.replace(/^\d+\. (.+)/, '$1');
      processedLines.push(`<li class="mb-1">${content}</li>`);
    }
    // Regular line
    else {
      if (inList) {
        processedLines.push(`</${listType}>`);
        inList = false;
        listType = '';
      }
      if (line.trim() !== '') {
        processedLines.push(line);
      } else {
        processedLines.push(''); // Preserve empty lines for paragraph breaks
      }
    }
  }
  
  // Close any remaining lists
  if (inList) {
    processedLines.push(`</${listType}>`);
  }
  
  // Join lines and convert double line breaks to paragraph breaks
  result = processedLines.join('\n');
  result = result.replace(/\n\s*\n/g, '</p><p class="mb-3">');
  
  // Wrap in paragraph tags, but not if it starts with a heading or list
  if (!result.match(/^<[h123456ul ol]/)) {
    result = '<p class="mb-3">' + result;
  }
  if (!result.match(/<\/[h123456ul ol]>$/)) {
    result = result + '</p>';
  }
  
  // Clean up empty paragraphs and fix formatting
  result = result.replace(/<p class="mb-3">\s*<\/p>/g, '');
  result = result.replace(/<p class="mb-3">\s*(<[h123456ul ol])/g, '$1');
  result = result.replace(/(<\/[h123456ul ol]>)\s*<\/p>/g, '$1');
  
  return result;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function MedicalInsightsChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeMode, setActiveMode] = useState("chat");
  
  // Educational content form state
  const [educationContentType, setEducationContentType] = useState("");
  const [educationWoundType, setEducationWoundType] = useState("");
  const [educationTreatmentStage, setEducationTreatmentStage] = useState("");
  const [educationPatientAge, setEducationPatientAge] = useState("");
  const [educationComplications, setEducationComplications] = useState<string[]>([]);
  const [educationAdditionalNotes, setEducationAdditionalNotes] = useState("");
  
  // Wound Assessment form state
  const [woundDescription, setWoundDescription] = useState("");
  const [patientInfo, setPatientInfo] = useState("");
  
  // Treatment Protocol form state
  const [woundType, setWoundType] = useState("");
  const [severity, setSeverity] = useState("");
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/chat", { question });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response, 
        timestamp: new Date() 
      }]);
      setQuestion("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const assessmentMutation = useMutation({
    mutationFn: async (data: { woundDescription: string; patientInfo?: string }) => {
      const response = await apiRequest("POST", "/api/wound-assessment", data);
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage = `Wound Assessment Request: ${woundDescription}${patientInfo ? `, Patient Info: ${patientInfo}` : ''}`;
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.assessment, timestamp: new Date() }
      ]);
      setWoundDescription("");
      setPatientInfo("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const protocolMutation = useMutation({
    mutationFn: async (data: { woundType: string; severity: string }) => {
      const response = await apiRequest("POST", "/api/treatment-protocol", data);
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage = `Treatment Protocol Request: ${woundType.replace('-', ' ')} - ${severity} severity`;
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.protocol, timestamp: new Date() }
      ]);
      setWoundType("");
      setSeverity("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate protocol. Please try again.",
        variant: "destructive",
      });
    },
  });

  const educationMutation = useMutation({
    mutationFn: async (data: {
      woundType: string;
      patientAge: string;
      treatmentStage: string;
      complications: string[];
      additionalNotes: string;
      contentType: string;
    }) => {
      const response = await apiRequest("POST", "/api/generate-education", data);
      return response.json();
    },
    onSuccess: (data) => {
      const userMessage = `Educational Content Request: ${educationContentType.replace('-', ' ')} for ${educationWoundType.replace('-', ' ')} at ${educationTreatmentStage.replace('-', ' ')} stage`;
      setMessages(prev => [
        ...prev,
        { role: "user", content: userMessage, timestamp: new Date() },
        { role: "assistant", content: data.content, timestamp: new Date() }
      ]);
      // Clear education form
      setEducationContentType("");
      setEducationWoundType("");
      setEducationTreatmentStage("");
      setEducationPatientAge("");
      setEducationComplications([]);
      setEducationAdditionalNotes("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate educational content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || chatMutation.isPending) return;

    setMessages(prev => [...prev, { 
      role: "user", 
      content: question, 
      timestamp: new Date() 
    }]);
    
    chatMutation.mutate(question);
  };

  const handleAssessmentSubmit = () => {
    if (!woundDescription.trim() || assessmentMutation.isPending) return;
    assessmentMutation.mutate({ woundDescription, patientInfo });
  };

  const handleProtocolSubmit = () => {
    if (!woundType || !severity || protocolMutation.isPending) return;
    protocolMutation.mutate({ woundType, severity });
  };

  const handleEducationSubmit = () => {
    if (!educationContentType || !educationWoundType || !educationTreatmentStage || educationMutation.isPending) return;
    educationMutation.mutate({
      woundType: educationWoundType,
      patientAge: educationPatientAge,
      treatmentStage: educationTreatmentStage,
      complications: educationComplications,
      additionalNotes: educationAdditionalNotes,
      contentType: educationContentType
    });
  };

  const handleEducationComplicationToggle = (complication: string) => {
    setEducationComplications(prev => 
      prev.includes(complication) 
        ? prev.filter(c => c !== complication)
        : [...prev, complication]
    );
  };

  const clearConversation = () => {
    setMessages([]);
    setQuestion("");
    setWoundDescription("");
    setPatientInfo("");
    setWoundType("");
    setSeverity("");
    setEducationContentType("");
    setEducationWoundType("");
    setEducationTreatmentStage("");
    setEducationPatientAge("");
    setEducationComplications([]);
    setEducationAdditionalNotes("");
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Stethoscope className="h-8 w-8 text-blue-600" />
          <h2 className="text-3xl font-bold text-gray-900">Medical Insights AI</h2>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Advanced wound care assistance powered by AI. Get clinical insights, assessments, and treatment protocols.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center mb-6">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveMode("chat")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "chat" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <MessageCircle className="h-4 w-4 inline mr-2" />
            Chat
          </button>
          <button
            onClick={() => setActiveMode("assessment")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "assessment" 
                ? "bg-white text-green-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="h-4 w-4 inline mr-2" />
            Assessment
          </button>
          <button
            onClick={() => setActiveMode("protocol")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "protocol" 
                ? "bg-white text-orange-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Target className="h-4 w-4 inline mr-2" />
            Protocol
          </button>
          <button
            onClick={() => setActiveMode("education")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeMode === "education" 
                ? "bg-white text-purple-600 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BookOpen className="h-4 w-4 inline mr-2" />
            Education
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      {messages.length > 0 && (
        <Card className="mb-6 p-0 overflow-hidden">
          <div className="max-h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    {message.role === 'user' ? (
                      <MessageCircle className="h-4 w-4 mt-0.5" />
                    ) : (
                      <Stethoscope className="h-4 w-4 mt-0.5" />
                    )}
                    <span className="font-medium text-sm">
                      {message.role === 'user' ? 'You' : 'Medical AI'}
                    </span>
                  </div>
                  <div 
                    className="break-words leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: formatMessageContent(message.content)
                    }}
                  />
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t p-4 bg-gray-50">
            <Button
              onClick={clearConversation}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Clear Conversation
            </Button>
          </div>
        </Card>
      )}

      {/* Input Area */}
      <Card className="p-6">
        {activeMode === "chat" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              Ask Medical AI
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about wound care, treatment options, clinical protocols..."
                  className="resize-none pr-12 min-h-[100px]"
                  disabled={chatMutation.isPending}
                />
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    type="submit"
                    disabled={!question.trim() || chatMutation.isPending}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {activeMode === "assessment" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Wound Assessment Analysis
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wound Description *</label>
                <Textarea
                  value={woundDescription}
                  onChange={(e) => setWoundDescription(e.target.value)}
                  placeholder="Describe wound characteristics: location, size, depth, exudate, tissue type, surrounding skin condition..."
                  className="resize-none min-h-[100px]"
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Patient Information (Optional)</label>
                <Textarea
                  value={patientInfo}
                  onChange={(e) => setPatientInfo(e.target.value)}
                  placeholder="Patient age, medical history, medications, mobility status, nutrition..."
                  className="resize-none"
                  rows={3}
                  disabled={assessmentMutation.isPending}
                />
              </div>

              <Button
                onClick={handleAssessmentSubmit}
                disabled={!woundDescription.trim() || assessmentMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {assessmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Assessment
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {activeMode === "protocol" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600" />
              Treatment Protocol Generator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Wound Type *</label>
                <Select value={woundType} onValueChange={setWoundType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wound type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pressure-ulcer">Pressure Ulcer</SelectItem>
                    <SelectItem value="diabetic-ulcer">Diabetic Foot Ulcer</SelectItem>
                    <SelectItem value="venous-ulcer">Venous Leg Ulcer</SelectItem>
                    <SelectItem value="arterial-ulcer">Arterial Ulcer</SelectItem>
                    <SelectItem value="surgical-wound">Surgical Wound</SelectItem>
                    <SelectItem value="traumatic-wound">Traumatic Wound</SelectItem>
                    <SelectItem value="burns">Burn Injury</SelectItem>
                    <SelectItem value="chronic-wound">Chronic Wound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Severity Level *</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild (Stage I-II)</SelectItem>
                    <SelectItem value="moderate">Moderate (Stage II-III)</SelectItem>
                    <SelectItem value="severe">Severe (Stage III-IV)</SelectItem>
                    <SelectItem value="critical">Critical/Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleProtocolSubmit}
                disabled={!woundType || !severity || protocolMutation.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {protocolMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Target className="h-4 w-4 mr-2" />
                    Generate Protocol
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {activeMode === "education" && (
          <div>
            <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              Patient Educational Content Generator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Content Type *</label>
                <Select value={educationContentType} onValueChange={setEducationContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructions">Home Care Instructions</SelectItem>
                    <SelectItem value="education">Educational Information</SelectItem>
                    <SelectItem value="expectations">What to Expect</SelectItem>
                    <SelectItem value="warning-signs">Warning Signs to Watch</SelectItem>
                    <SelectItem value="diet-nutrition">Diet & Nutrition Guide</SelectItem>
                    <SelectItem value="activity-restrictions">Activity Guidelines</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Wound Type *</label>
                <Select value={educationWoundType} onValueChange={setEducationWoundType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wound type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pressure-ulcer">Pressure Ulcer</SelectItem>
                    <SelectItem value="diabetic-ulcer">Diabetic Foot Ulcer</SelectItem>
                    <SelectItem value="venous-ulcer">Venous Leg Ulcer</SelectItem>
                    <SelectItem value="arterial-ulcer">Arterial Ulcer</SelectItem>
                    <SelectItem value="surgical-wound">Surgical Wound</SelectItem>
                    <SelectItem value="traumatic-wound">Traumatic Wound</SelectItem>
                    <SelectItem value="burns">Burn Injury</SelectItem>
                    <SelectItem value="chronic-wound">Chronic Wound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Treatment Stage *</label>
                <Select value={educationTreatmentStage} onValueChange={setEducationTreatmentStage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select treatment stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial-assessment">Initial Assessment</SelectItem>
                    <SelectItem value="active-treatment">Active Treatment</SelectItem>
                    <SelectItem value="healing-phase">Healing Phase</SelectItem>
                    <SelectItem value="maintenance">Maintenance Care</SelectItem>
                    <SelectItem value="post-healing">Post-Healing Care</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Patient Age (Optional)</label>
                <Input
                  type="number"
                  value={educationPatientAge}
                  onChange={(e) => setEducationPatientAge(e.target.value)}
                  placeholder="Enter patient age"
                  min="1"
                  max="120"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Complications/Risk Factors</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Diabetes",
                    "Poor Circulation",
                    "Infection Risk",
                    "Mobility Issues",
                    "Nutrition Concerns",
                    "Medication Compliance",
                    "Previous Wound History"
                  ].map((complication) => (
                    <div key={complication} className="flex items-center space-x-2">
                      <Checkbox
                        id={complication}
                        checked={educationComplications.includes(complication)}
                        onCheckedChange={() => handleEducationComplicationToggle(complication)}
                      />
                      <label htmlFor={complication} className="text-sm">{complication}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
                <Textarea
                  value={educationAdditionalNotes}
                  onChange={(e) => setEducationAdditionalNotes(e.target.value)}
                  placeholder="Any specific patient concerns, cultural considerations, or special instructions..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleEducationSubmit}
                disabled={!educationContentType || !educationWoundType || !educationTreatmentStage || educationMutation.isPending}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {educationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Generate Patient Education
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}