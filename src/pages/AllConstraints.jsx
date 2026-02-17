import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, ArrowRight, Trash2, Filter, List, Plus, Edit } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import MonthCalendar from '../components/shifts/MonthCalendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export default function AllConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' או 'list'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: allConstraints = [] } = useQuery({
    queryKey: ['constraints', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Constraint.list();
      const filtered = all.filter(c => c.date && c.date.startsWith(monthKey));
      
      // הסר כפילויות - אם יש כמה אילוצים לאותו עובד באותו תאריך, קח רק את האחרון
      const uniqueMap = new Map();
      filtered.forEach(c => {
        const key = `${c.date}-${c.employee_id}`;
        const existing = uniqueMap.get(key);
        if (!existing || new Date(c.updated_date) > new Date(existing.updated_date)) {
          uniqueMap.set(key, c);
        }
      });
      
      return Array.from(uniqueMap.values());
    },
  });

  const { data: recurringConstraints = [] } = useQuery({
    queryKey: ['recurringConstraints'],
    queryFn: () => base44.entities.RecurringConstraint.list(),
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נמחק בהצלחה' });
    },
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נוסף בהצלחה' });
      setDialogOpen(false);
      setEditingConstraint(null);
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ עודכן בהצלחה' });
      setDialogOpen(false);
      setEditingConstraint(null);
    },
  });

  const filteredConstraints = allConstraints
    .filter(c => {
      // סנן אילוצים עם employee_id לא קיים
      const employeeExists = employees.some(e => e.id === c.employee_id);
      if (!employeeExists) return false;
      
      const employeeMatch = filterEmployee === 'all' || c.employee_id === filterEmployee;
      const typeMatch = filterType === 'all' || 
        (filterType === 'unavailable' && c.unavailable) ||
        (filterType === 'preference' && c.preference && !c.unavailable);
      return employeeMatch && typeMatch;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleDeleteAll = async () => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את כל ${allConstraints.length} האילוצים לחודש זה?`)) return;
    
    for (const constraint of allConstraints) {
      await deleteConstraintMutation.mutateAsync(constraint.id);
    }
    toast({ title: `נמחקו ${allConstraints.length} אילוצים` });
  };

  const getEmployeeName = (empId) => {
    const emp = employees.find(e => e.id === empId);
    return emp?.full_name || 'לא ידוע';
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayNumber = format(date, 'd');
    
    // מצא אילוצים ליום זה (רק עם employee_id קיים)
    const dayConstraints = allConstraints.filter(c => {
      if (c.date !== dateStr) return false;
      return employees.some(e => e.id === c.employee_id);
    });
    
    // בדוק אילוצים חוזרים (כולל כל הסטטוסים)
    const dayRecurringConstraints = recurringConstraints.filter(rc => rc.day_of_week === dayOfWeek);
    
    // סינון לפי עובד נבחר
    const filteredDayConstraints = filterEmployee === 'all' 
      ? dayConstraints 
      : dayConstraints.filter(c => c.employee_id === filterEmployee);
    
    const filteredRecurringConstraints = filterEmployee === 'all'
      ? dayRecurringConstraints
      : dayRecurringConstraints.filter(rc => rc.employee_id === filterEmployee);

    // סינון לפי סוג
    const finalConstraints = filteredDayConstraints.filter(c => {
      if (filterType === 'all') return true;
      if (filterType === 'unavailable') return c.unavailable;
      if (filterType === 'preference') return c.preference && !c.unavailable;
      return true;
    });

    const totalItems = finalConstraints.length + filteredRecurringConstraints.length;
    const hasUnavailable = finalConstraints.some(c => c.unavailable) || filteredRecurringConstraints.length > 0;

    return (
      <div
        key={date.toString()}
        className={`p-2 border-2 rounded-lg min-h-[100px] ${
          hasUnavailable ? 'bg-red-50 border-red-300' : 
          totalItems > 0 ? 'bg-blue-50 border-blue-300' : 
          'bg-white border-gray-200'
        }`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {/* אילוצים חוזרים */}
          {filteredRecurringConstraints.map(rc => {
            const empName = getEmployeeName(rc.employee_id);
            const statusColor = rc.status === 'אושר' ? 'bg-orange-200 border-orange-400' :
                               rc.status === 'נדחה' ? 'bg-gray-200 border-gray-400' :
                               'bg-yellow-200 border-yellow-400';
            return (
              <div key={`rc-${rc.id}`} className={`text-[10px] p-1 rounded border ${statusColor}`}>
                <div className="font-bold text-orange-900">🔄 {empName}</div>
                <div className="text-orange-700 text-[9px]">אילוץ קבוע • {rc.status}</div>
                {rc.notes && <div className="text-[9px] mt-1">{rc.notes}</div>}
              </div>
            );
          })}
          
          {/* אילוצים רגילים */}
          {finalConstraints.map(c => {
            const empName = getEmployeeName(c.employee_id);
            return (
              <div 
                key={c.id} 
                className={`text-[10px] p-1 rounded border ${
                  c.unavailable 
                    ? 'bg-red-200 border-red-400' 
                    : 'bg-blue-200 border-blue-400'
                }`}
              >
                <div className="font-bold">{empName}</div>
                {c.unavailable && <div className="text-red-700 text-[9px]">לא זמין</div>}
                {c.preference && <div className="text-blue-700 text-[9px]">{c.preference}</div>}
                {c.notes && <div className="text-gray-700 text-[9px] mt-1">💬 {c.notes}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">כל האילוצים וההעדפות</h1>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => { setEditingConstraint(null); setDialogOpen(true); }} variant="default">
              <Plus className="w-4 h-4 ml-2" />
              הוסף אילוץ
            </Button>
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה ללוח משמרות
              </Button>
            </Link>
            <Button onClick={() => setCurrentDate(new Date(year, month - 2))} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month))} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4 items-center justify-between flex-wrap">
            <div className="flex gap-4 items-center flex-wrap">
              <Filter className="w-5 h-5 text-gray-500" />
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="כל העובדים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל העובדים</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="כל הסוגים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  <SelectItem value="unavailable">לא זמין בלבד</SelectItem>
                  <SelectItem value="preference">העדפות בלבד</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={viewMode === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('calendar')}
              >
                📅 לוח
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4 ml-2" />
                רשימה
              </Button>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-lg px-4 py-2">
                {filteredConstraints.length} אילוצים
              </Badge>
              {allConstraints.length > 0 && (
                <Button 
                  onClick={handleDeleteAll} 
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  מחק הכל
                </Button>
              )}
            </div>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div>
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">מקרא:</h3>
              <div className="flex gap-4 flex-wrap text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-200 border-2 border-red-400 rounded"></div>
                  <span>לא זמין</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-200 border-2 border-blue-400 rounded"></div>
                  <span>העדפה</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-200 border-2 border-orange-400 rounded"></div>
                  <span>🔄 אילוץ קבוע (לימודים)</span>
                </div>
              </div>
            </div>
            <MonthCalendar year={year} month={month} renderDay={renderDay} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {filteredConstraints.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-xl">אין אילוצים לחודש זה</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConstraints.map((constraint) => (
                  <div key={constraint.id} className="p-4 hover:bg-gray-50 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-bold text-lg">
                          {format(new Date(constraint.date), 'dd/MM/yyyy')}
                        </div>
                        <Badge variant="outline">{getEmployeeName(constraint.employee_id)}</Badge>
                        {constraint.unavailable ? (
                          <Badge variant="destructive">לא זמין</Badge>
                        ) : (
                          <Badge variant="secondary">זמין</Badge>
                        )}
                      </div>
                      {constraint.preference && (
                        <div className="text-sm text-blue-700 mb-1">
                          <strong>העדפה:</strong> {constraint.preference}
                        </div>
                      )}
                      {constraint.notes && (
                        <div className="text-sm text-gray-600">
                          <strong>הערות:</strong> {constraint.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingConstraint(constraint);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('האם למחוק אילוץ זה?')) {
                            deleteConstraintMutation.mutate(constraint.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingConstraint ? 'ערוך אילוץ' : 'הוסף אילוץ חדש'}</DialogTitle>
            </DialogHeader>
            <ConstraintEditForm
              constraint={editingConstraint}
              employees={employees}
              onSave={(data) => {
                if (editingConstraint) {
                  updateConstraintMutation.mutate({ id: editingConstraint.id, data });
                } else {
                  createConstraintMutation.mutate(data);
                }
              }}
              onCancel={() => {
                setDialogOpen(false);
                setEditingConstraint(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ConstraintEditForm({ constraint, employees, onSave, onCancel }) {
  const [employeeId, setEmployeeId] = useState(constraint?.employee_id || '');
  const [date, setDate] = useState(constraint?.date || '');
  const [unavailable, setUnavailable] = useState(constraint?.unavailable || false);
  const [preference, setPreference] = useState(constraint?.preference || '');
  const [notes, setNotes] = useState(constraint?.notes || '');

  const selectedDate = date ? new Date(date) : null;
  const dayOfWeek = selectedDate ? getDay(selectedDate) : null;
  const isFriday = dayOfWeek === 5;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId || !date) {
      alert('יש למלא עובד ותאריך');
      return;
    }
    onSave({ employee_id: employeeId, date, unavailable, preference: unavailable ? '' : preference, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>עובד</Label>
        <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!constraint}>
          <SelectTrigger>
            <SelectValue placeholder="בחר עובד..." />
          </SelectTrigger>
          <SelectContent>
            {employees.filter(e => e.active).map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>תאריך</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={!!constraint}
        />
      </div>

      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Switch 
            checked={unavailable} 
            onCheckedChange={setUnavailable}
            className="data-[state=checked]:bg-red-600"
          />
          <div className="flex-1">
            <Label className="text-lg font-bold text-red-700">לא זמין</Label>
            <p className="text-sm text-red-600 mt-1">סמן אם העובד לא זמין בתאריך זה</p>
          </div>
        </div>
      </div>

      {!unavailable && (
        <div>
          <Label>העדפת משמרת (אופציונלי)</Label>
          <Select value={preference || 'none'} onValueChange={(val) => setPreference(val === 'none' ? '' : val)}>
            <SelectTrigger>
              <SelectValue placeholder="בחר העדפה..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא העדפה</SelectItem>
              {isFriday ? (
                <>
                  <SelectItem value="מעדיף שישי קצר">מעדיף שישי קצר</SelectItem>
                  <SelectItem value="מעדיף שישי ארוך">מעדיף שישי ארוך</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="מעדיף משמרת מסיים ב-17:30">מעדיף משמרת עד 17:30</SelectItem>
                  <SelectItem value="מעדיף משמרת מסיים ב-19:00">מעדיף משמרת עד 19:00</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>הערות</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות נוספות..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
        <Button type="submit">
          {constraint ? 'עדכן' : 'הוסף'}
        </Button>
      </div>
    </form>
  );
}