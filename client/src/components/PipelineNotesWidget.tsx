import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PipelineNote {
  id: number;
  userId: number;
  patientName: string;
  followUpAction: string;
  priority: 'low' | 'medium' | 'high';
  woundSize: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface EditingCell {
  noteId: number;
  field: keyof PipelineNote;
}

const priorityColors = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  high: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
};

export function PipelineNotesWidget() {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch pipeline notes
  const { data: notes = [], isLoading } = useQuery<PipelineNote[]>({
    queryKey: ['/api/pipeline-notes'],
  });

  // Mutations for CRUD operations
  const createNoteMutation = useMutation({
    mutationFn: (data: Partial<PipelineNote>) => 
      apiRequest('/api/pipeline-notes', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PipelineNote> }) =>
      apiRequest(`/api/pipeline-notes/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
    },
    onError: () => {
      toast({ title: "Failed to update note", variant: "destructive" });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/pipeline-notes/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
      toast({ title: "Note deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete note", variant: "destructive" });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: (noteUpdates: Array<{ id: number; sortOrder: number }>) =>
      apiRequest('/api/pipeline-notes/reorder', 'POST', { noteUpdates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-notes'] });
    }
  });

  // Calculate total wound size
  const totalWoundSize = notes
    .filter((note: PipelineNote) => note.woundSize !== null)
    .reduce((sum: number, note: PipelineNote) => sum + (note.woundSize || 0), 0);

  // Handle cell editing
  const startEditing = (noteId: number, field: keyof PipelineNote, currentValue: any) => {
    setEditingCell({ noteId, field });
    setEditValue(currentValue?.toString() || "");
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    
    const { noteId, field } = editingCell;
    let value: any = editValue;

    // Convert types based on field
    if (field === 'woundSize') {
      value = editValue === "" ? null : parseFloat(editValue);
    } else if (field === 'priority') {
      if (!['low', 'medium', 'high'].includes(editValue)) {
        toast({ title: "Priority must be low, medium, or high", variant: "destructive" });
        setEditingCell(null);
        return;
      }
    }

    updateNoteMutation.mutate({ 
      id: noteId, 
      data: { [field]: value } 
    });
    
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const addNewNote = () => {
    const maxSortOrder = notes.length > 0 ? Math.max(...notes.map((n: PipelineNote) => n.sortOrder)) : 0;
    createNoteMutation.mutate({
      patientName: "New Patient",
      followUpAction: "Follow up action",
      priority: 'medium',
      woundSize: null,
      notes: "",
      sortOrder: maxSortOrder + 1
    });
  };

  // Handle drag and drop reordering
  const handleDragStart = (noteId: number) => {
    setDraggedRow(noteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetNoteId: number) => {
    e.preventDefault();
    if (!draggedRow || draggedRow === targetNoteId) {
      setDraggedRow(null);
      return;
    }

    const sortedNotes = [...notes].sort((a, b) => a.sortOrder - b.sortOrder);
    const draggedIndex = sortedNotes.findIndex(n => n.id === draggedRow);
    const targetIndex = sortedNotes.findIndex(n => n.id === targetNoteId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder the notes
    const reorderedNotes = [...sortedNotes];
    const [draggedNote] = reorderedNotes.splice(draggedIndex, 1);
    reorderedNotes.splice(targetIndex, 0, draggedNote);

    // Update sort orders
    const noteUpdates = reorderedNotes.map((note, index) => ({
      id: note.id,
      sortOrder: index + 1
    }));

    reorderMutation.mutate(noteUpdates);
    setDraggedRow(null);
  };

  const renderEditableCell = (note: PipelineNote, field: keyof PipelineNote, value: any) => {
    const isEditing = editingCell?.noteId === note.id && editingCell?.field === field;
    
    if (isEditing) {
      if (field === 'notes') {
        return (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            className="min-h-[60px] text-xs"
            autoFocus
          />
        );
      } else {
        return (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveEdit();
              } else if (e.key === 'Escape') {
                cancelEdit();
              }
            }}
            className="text-xs"
            type={field === 'woundSize' ? 'number' : 'text'}
            autoFocus
          />
        );
      }
    }

    // Render display value
    const handleClick = () => startEditing(note.id, field, value);
    
    if (field === 'priority') {
      return (
        <Badge 
          className={`cursor-pointer text-xs ${priorityColors[value as keyof typeof priorityColors]}`}
          onClick={handleClick}
        >
          {value}
        </Badge>
      );
    } else if (field === 'woundSize') {
      return (
        <div 
          className="cursor-pointer hover:bg-muted p-1 rounded text-xs text-center"
          onClick={handleClick}
        >
          {value !== null ? `${value} cm²` : "-"}
        </div>
      );
    } else if (field === 'notes') {
      return (
        <div 
          className="cursor-pointer hover:bg-muted p-1 rounded text-xs max-w-[150px] overflow-hidden text-ellipsis"
          onClick={handleClick}
        >
          {value || "Click to add notes..."}
        </div>
      );
    }

    return (
      <div 
        className="cursor-pointer hover:bg-muted p-1 rounded text-xs"
        onClick={handleClick}
      >
        {value}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pipeline Notes</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Pipeline Notes
              {totalWoundSize > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Calculator className="w-3 h-3 mr-1" />
                  Total: {totalWoundSize.toFixed(1)} cm²
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Track patients and organize your follow-up actions
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={addNewNote}
            disabled={createNoteMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Note
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="text-xs">Patient</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Priority</TableHead>
                <TableHead className="text-xs">Wound Size</TableHead>
                <TableHead className="text-xs min-w-[150px]">Notes</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                    No notes yet. Click "Add Note" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                notes
                  .sort((a: PipelineNote, b: PipelineNote) => a.sortOrder - b.sortOrder)
                  .map((note: PipelineNote) => (
                    <TableRow
                      key={note.id}
                      draggable
                      onDragStart={() => handleDragStart(note.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, note.id)}
                      className={`${draggedRow === note.id ? 'opacity-50' : ''} hover:bg-muted/50`}
                    >
                      <TableCell>
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell className="py-2">
                        {renderEditableCell(note, 'patientName', note.patientName)}
                      </TableCell>
                      <TableCell className="py-2">
                        {renderEditableCell(note, 'followUpAction', note.followUpAction)}
                      </TableCell>
                      <TableCell className="py-2">
                        {renderEditableCell(note, 'priority', note.priority)}
                      </TableCell>
                      <TableCell className="py-2">
                        {renderEditableCell(note, 'woundSize', note.woundSize)}
                      </TableCell>
                      <TableCell className="py-2">
                        {renderEditableCell(note, 'notes', note.notes)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          disabled={deleteNoteMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}