import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Plus, Trash2, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

const DAYS_OF_WEEK = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
];

export default function RecurringConstraints() {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.user_id === user.id);
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: recurringConstraints = [] } = useQuery({
    queryKey: ['recurringConstraints', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.RecurringConstraint.list();
      return all.filter(rc => rc.employee_id === currentEmployee.id);
    },
    enabled: !!currentEmployee,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringConstraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringConstraints']);
      toast({ title: 'אילוץ חוזר נוסף בהצלחה' });
      setDialogOpen(false);
      setSelectedDays([]);
      setNotes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RecurringConstraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringConstraints']);
      toast({ title: 'אילוץ חוזר נמחק' });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedDays.length === 0) {
      toast({ title: 'בחר לפחות יום אחד', variant: 'destructive' });
      return;
    }

    // צור אילוץ חוזר לכל יום שנבחר
    selectedDays.forEach(day => {
      createMutation.mutate({
        employee_id: currentEmployee.id,
        day_of_week: day,
        unavailable: true,
        notes,
      });
    });
  };

  const toggleDay = (day) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getDayLabel = (dayNum) => {
    const day = DAYS_OF_WEEK.find(d => d.value === dayNum);
    return day?.label || 'לא ידוע';
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">טוען...</div>;
  }

  if (!currentEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">חשבונך ממתין לחיבור</h2>
          <p className="text-gray-600 mb-6">מנהל המערכת יחבר את חשבונך לרשומת העובד שלך בקרוב</p>
          <Button onClick={() => base44.auth.logout()}>
            <LogOut className="w-4 h-4 ml-2" />
            יציאה
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">אילוצים חוזרים</h1>
          <div className="flex gap-2">
            <Link to={createPageUrl('EmployeeConstraints')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה
              </Button>
            </Link>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 ml-2" />
              הוסף אילוץ חוזר
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">💡 מהם אילוצים חוזרים?</h3>
          <p className="text-blue-800 text-sm">
            אילוצים חוזרים מאפשרים לך לסמן ימים בשבוע שבהם אתה לא זמין באופן קבוע.
            <br />
            לדוגמה: "אני לא זמין בכל יום ראשון" או "אני לא זמין בכל חמישי".
            <br />
            האילוצים האלה יחולו אוטומטית על כל השבועות, ולא תצטרך לסמן ידנית כל פעם.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {recurringConstraints.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl mb-2">אין אילוצים חוזרים</p>
              <p className="text-sm">לחץ על "הוסף אילוץ חוזר" כדי להוסיף</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">יום בשבוע</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringConstraints.map((constraint) => (
                  <TableRow key={constraint.id}>
                    <TableCell className="font-medium text-lg">
                      {getDayLabel(constraint.day_of_week)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">לא זמין</Badge>
                    </TableCell>
                    <TableCell>
                      {constraint.notes || <span className="text-gray-400">-</span>}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('האם למחוק אילוץ חוזר זה?')) {
                            deleteMutation.mutate(constraint.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>הוסף אילוץ חוזר</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="mb-3 block">בחר ימים בשבוע שבהם אתה לא זמין:</Label>
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  {DAYS_OF_WEEK.map(day => (
                    <div key={day.value} className="flex items-center gap-3">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                      <Label 
                        htmlFor={`day-${day.value}`} 
                        className="text-lg cursor-pointer"
                      >
                        כל יום {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>הערות (אופציונלי)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="למשל: לימודים, מילואים, עבודה נוספת..."
                  rows={3}
                />
              </div>

              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                ⚠️ האילוץ יחול על כל השבועות מעכשיו והלאה
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit" disabled={selectedDays.length === 0}>
                  הוסף
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}