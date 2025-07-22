import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  FileText, 
  Loader2,
  Download,
  Printer,
  Mail,
  Copy
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function EducationalContentGenerator() {
  const [woundType, setWoundType] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [treatmentStage, setTreatmentStage] = useState("");
  const [complications, setComplications] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [contentType, setContentType] = useState("instructions");
  const [generatedContent, setGeneratedContent] = useState("");
  
  const { toast } = useToast();

  const generateContentMutation = useMutation({
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
      setGeneratedContent(data.content);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate educational content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleComplicationToggle = (complication: string) => {
    setComplications(prev => 
      prev.includes(complication) 
        ? prev.filter(c => c !== complication)
        : [...prev, complication]
    );
  };

  const handleGenerate = () => {
    if (!woundType || !treatmentStage) {
      toast({
        title: "Missing Information",
        description: "Please select wound type and treatment stage.",
        variant: "destructive",
      });
      return;
    }

    generateContentMutation.mutate({
      woundType,
      patientAge,
      treatmentStage,
      complications,
      additionalNotes,
      contentType
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard.",
    });
  };

  const printContent = () => {
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html>
        <head>
          <title>Patient Education Materials</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            h1 { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            h2 { color: #1f2937; margin-top: 25px; }
            p { margin-bottom: 15px; }
            ul { margin-left: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .footer { margin-top: 40px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NXT Medical - Patient Education</h1>
            <p>Personalized Wound Care Instructions</p>
          </div>
          <div style="white-space: pre-wrap;">${generatedContent}</div>
          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} | Contact your healthcare provider with questions</p>
          </div>
        </body>
      </html>
    `);
    printWindow?.document.close();
    printWindow?.print();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BookOpen className="h-8 w-8 text-green-600" />
          <h2 className="text-3xl font-bold text-gray-900">AI Educational Content Generator</h2>
        </div>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Create personalized wound care instructions and educational materials for your patients using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Patient Information & Content Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Content Type *</label>
              <Select value={contentType} onValueChange={setContentType}>
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
              <label className="block text-sm font-medium mb-2">Treatment Stage *</label>
              <Select value={treatmentStage} onValueChange={setTreatmentStage}>
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
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="Enter patient age"
                min="1"
                max="120"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Complications/Risk Factors</label>
              <div className="space-y-2">
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
                      checked={complications.includes(complication)}
                      onCheckedChange={() => handleComplicationToggle(complication)}
                    />
                    <label htmlFor={complication} className="text-sm">{complication}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Additional Notes (Optional)</label>
              <Textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any specific patient concerns, cultural considerations, or special instructions..."
                rows={3}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!woundType || !treatmentStage || generateContentMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {generateContentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Content...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Generate Educational Content
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated Content Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Generated Educational Content
            </CardTitle>
            {generatedContent && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={printContent}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!generatedContent ? (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No content generated yet</p>
                <p className="text-sm">Fill out the form and click "Generate Educational Content" to create personalized materials for your patient</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="max-h-96 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {generatedContent}
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-medium text-sm mb-2 text-gray-700">Next Steps:</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Review content for accuracy and personalization</li>
                    <li>• Print or email to patient</li>
                    <li>• Schedule follow-up to ensure understanding</li>
                    <li>• Document educational materials provided in patient record</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}