import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, LogOut, Calendar, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import NotificationBell from '../components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MonthCalendar from '../components/shifts/MonthCalendar';
import CalendarViewToggle from '../components/shifts/CalendarViewToggle';
import WeekCalendar from '../components/shifts/WeekCalendar';
import AgendaView from '../components/shifts/AgendaView';
import { AlertTriangle } from 'lucide-react';

export default function EmployeeConstraints() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState('month');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        const allEmployees = await base44.entities.Employee.list();
        const employee = allEmployees.find(emp => emp.user_id === user.id);
        setCurrentEmployee(employee);
      } finally {
        setLoading(false);
      }
    };
    loadEmployee();
  }, []);

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.employee_id === currentEmployee.id && c.date.startsWith(monthKey));
    },
    enabled: !!currentEmployee,
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['vacationRequests', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.VacationRequest.list('-created_date');
      return all.filter(v => v.employee_id === currentEmployee.id);
    },
    enabled: !!currentEmployee,
  });

  const createConstraintMutation = useMutation({
    mutationFn: (data) => base44.entities.Constraint.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נשמר בהצלחה' });
      setDialogOpen(false);
    },
  });

  const updateConstraintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Constraint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ עודכן בהצלחה' });
      setDialogOpen(false);
    },
  });

  const deleteConstraintMutation = useMutation({
    mutationFn: (id) => base44.entities.Constraint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['constraints']);
      toast({ title: 'אילוץ נמחק בהצלחה' });
    },
  });

  const createVacationRequestMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacationRequests']);
      toast({ title: 'בקשת חופשה נשלחה למנהל' });
      setVacationDialogOpen(false);
    },
  });

  const handleSaveConstraint = (constraintData) => {
    const existing = constraints.find(c => c.date === selectedDate);
    if (existing) {
      updateConstraintMutation.mutate({ id: existing.id, data: constraintData });
    } else {
      createConstraintMutation.mutate({ ...constraintData, employee_id: currentEmployee.id, date: selectedDate });
    }
  };

  const handleSaveRangeConstraint = async (startDate, endDate, constraintData) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      dates.push(dateStr);
    }

    for (const date of dates) {
      const existing = constraints.find(c => c.date === date);
      if (existing) {
        await updateConstraintMutation.mutateAsync({ id: existing.id, data: constraintData });
      } else {
        await createConstraintMutation.mutateAsync({ ...constraintData, employee_id: currentEmployee.id, date });
      }
    }
    
    setRangeDialogOpen(false);
    toast({ title: `נשמרו ${dates.length} ימים` });
  };

  const handleVacationRequest = (data) => {
    createVacationRequestMutation.mutate({
      ...data,
      employee_id: currentEmployee.id,
    });
  };

  const getConstraintsForDate = (dateStr) => {
    const constraint = constraints.find(c => c.date === dateStr);
    const approvedVacation = vacationRequests.find(v => 
      v.status === 'אושר' && 
      dateStr >= v.start_date && 
      dateStr <= v.end_date
    );
    return { constraint, approvedVacation };
  };

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const { constraint, approvedVacation } = getConstraintsForDate(dateStr);
    const dayNumber = format(date, 'd');
    
    // Count items for density indicator
    const itemCount = (constraint ? 1 : 0) + (approvedVacation ? 1 : 0);
    const hasMultipleItems = itemCount > 1;

    return (
      <div
        key={date.toString()}
        onClick={() => { setSelectedDate(dateStr); setDialogOpen(true); }}
        className={`p-3 border-2 rounded-lg cursor-pointer hover:shadow-md min-h-[80px] relative ${
          approvedVacation ? 'bg-green-100 border-green-500' :
          constraint?.unavailable ? 'bg-red-100 border-red-400' :
          constraint?.preference === 'מעדיף לסיים ב-17:30' ? 'bg-blue-100 border-blue-400' :
          constraint?.preference === 'מעדיף לסיים ב-19:00' ? 'bg-purple-100 border-purple-400' :
          'bg-white'
        }`}
      >
        {hasMultipleItems && (
          <div className="absolute top-1 left-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
          </div>
        )}
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        <div className="space-y-1">
          {approvedVacation && (
            <div className="text-xs text-center">
              <div className="font-bold text-green-700">✓ {approvedVacation.type}</div>
              <div className="text-green-600 text-[10px]">מאושר</div>
            </div>
          )}
          {constraint && (
            <div className="text-xs text-center">
              {constraint.unavailable && <div className="font-bold text-red-600">לא זמין</div>}
              {constraint.preference && (
                <div className="text-gray-700 text-[10px]">{constraint.preference}</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" dir="rtl">טוען...</div>;
  }

  if (!currentEmployee) {
    if (currentUser?.role === 'admin') {
      window.location.href = '/ManagerDashboard';
      return <div className="min-h-screen flex items-center justify-center" dir="rtl">מעביר אותך ללוח בקרה...</div>;
    }
    
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

  const pendingVacations = vacationRequests.filter(v => v.status === 'ממתין לאישור');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">{currentEmployee.full_name} - אילוצים והעדפות</h1>
          <div className="flex gap-2 flex-wrap">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Link to={createPageUrl('EmployeeShifts')}>
              <Button variant="outline">המשמרות שלי</Button>
            </Link>
            <Link to={createPageUrl('EmployeeSwaps')}>
              <Button variant="outline">החלפת משמרות</Button>
            </Link>
            <Button onClick={() => setVacationDialogOpen(true)} variant="default">
              <Briefcase className="w-4 h-4 ml-2" />
              בקשת חופשה {pendingVacations.length > 0 && `(${pendingVacations.length})`}
            </Button>
            <Button onClick={() => setRangeDialogOpen(true)} variant="outline">
              <Calendar className="w-4 h-4 ml-2" />
              סימון ימים מרובים
            </Button>
            <Link to={createPageUrl('RecurringConstraints')}>
              <Button variant="outline">
                🔄 אילוצים חוזרים
              </Button>
            </Link>
            <Button 
              onClick={async () => {
                if (confirm('האם אתה בטוח שברצונך למחוק את כל האילוצים שלך?')) {
                  const allConstraints = await base44.entities.Constraint.list();
                  const myConstraints = allConstraints.filter(c => c.employee_id === currentEmployee.id);
                  for (const constraint of myConstraints) {
                    await deleteConstraintMutation.mutateAsync(constraint.id);
                  }
                  toast({ title: `נמחקו ${myConstraints.length} אילוצים` });
                }
              }}
              variant="destructive"
            >
              מחק את כל האילוצים שלי
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month - 2))} variant="outline">
              <ChevronRight className="w-5 h-5" />
            </Button>
            <Button onClick={() => setCurrentDate(new Date(year, month))} variant="outline">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        {pendingVacations.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-yellow-800 mb-2">
              ⏳ יש לך {pendingVacations.length} בקשות חופשה ממתינות לאישור
            </h3>
            <div className="space-y-2">
              {pendingVacations.map(v => (
               <div key={v.id} className="text-sm text-yellow-700">
                 • {v.type}: {format(new Date(v.start_date), 'dd/MM/yyyy')} - {format(new Date(v.end_date), 'dd/MM/yyyy')}
               </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold mb-2">מקרא:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-100 border-2 border-green-500"></div>
                  <span className="text-sm">חופש מאושר</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-red-100 border-2 border-red-400"></div>
                  <span className="text-sm">לא זמין</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 border-2 border-blue-400"></div>
                  <span className="text-sm">מעדיף לסיים ב-17:30</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-100 border-2 border-purple-400"></div>
                  <span className="text-sm">מעדיף לסיים ב-19:00</span>
                </div>
              </div>
            </div>
            <CalendarViewToggle view={calendarView} onViewChange={setCalendarView} />
          </div>
        </div>

        {calendarView === 'month' && <MonthCalendar year={year} month={month} renderDay={renderDay} />}
        
        {calendarView === 'week' && (
          <WeekCalendar 
            currentDate={currentDate} 
            onDateChange={setCurrentDate}
            renderDay={renderDay}
          />
        )}
        
        {calendarView === 'agenda' && (
          <AgendaView
            currentDate={currentDate}
            items={constraints.concat(vacationRequests.filter(v => v.status === 'אושר'))}
            getItemsForDate={(dateStr) => {
              const { constraint, approvedVacation } = getConstraintsForDate(dateStr);
              const items = [];
              if (approvedVacation) items.push({ type: 'vacation', data: approvedVacation });
              if (constraint) items.push({ type: 'constraint', data: constraint });
              return items;
            }}
            renderItem={(item, idx) => (
              <div key={idx} className={`p-2 rounded-lg text-sm ${
                item.type === 'vacation' ? 'bg-green-100 border border-green-500' :
                item.data.unavailable ? 'bg-red-100 border border-red-400' :
                'bg-blue-100 border border-blue-400'
              }`}>
                {item.type === 'vacation' ? (
                  <div>
                    <div className="font-bold text-green-700">✓ {item.data.type}</div>
                    <div className="text-green-600 text-xs">מאושר</div>
                  </div>
                ) : (
                  <div>
                    {item.data.unavailable && <div className="font-bold text-red-600">לא זמין</div>}
                    {item.data.preference && <div className="text-gray-700 text-xs">{item.data.preference}</div>}
                    {item.data.notes && <div className="text-gray-600 text-xs mt-1">{item.data.notes}</div>}
                  </div>
                )}
              </div>
            )}
          />
        )}

        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h3 className="font-bold text-lg mb-4">היסטוריית בקשות חופשה</h3>
          {vacationRequests.length === 0 ? (
            <p className="text-center text-gray-500 py-4">אין בקשות חופשה</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">תאריכים</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacationRequests.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {format(new Date(v.start_date), 'dd/MM/yyyy')} - {format(new Date(v.end_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>{v.type}</TableCell>
                    <TableCell>
                      <Badge variant={
                        v.status === 'אושר' ? 'default' :
                        v.status === 'נדחה' ? 'destructive' :
                        'secondary'
                      }>
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.manager_notes && <div className="text-sm text-gray-600">{v.manager_notes}</div>}
                      {v.notes && <div className="text-xs text-gray-500 mt-1">{v.notes}</div>}
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
              <DialogTitle>אילוצים והעדפות - {selectedDate}</DialogTitle>
            </DialogHeader>
            <ConstraintForm
              selectedDate={selectedDate}
              existingConstraint={constraints.find(c => c.date === selectedDate)}
              onSave={handleSaveConstraint}
              onDelete={(id) => deleteConstraintMutation.mutate(id)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>סימון ימים מרובים</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-4">
              סמן מספר ימים כלא זמין או עם העדפה
            </p>
            <RangeConstraintForm onSave={handleSaveRangeConstraint} />
          </DialogContent>
        </Dialog>

        <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>בקשת חופשה או היעדרות</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600 mb-4">
              שלח בקשה למנהל לאישור חופשה, מחלה או היעדרות אחרת
            </p>
            <VacationRequestForm onSave={handleVacationRequest} />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ConstraintForm({ selectedDate, existingConstraint, onSave, onDelete }) {
  const [unavailable, setUnavailable] = useState(existingConstraint?.unavailable || false);
  const [preference, setPreference] = useState(existingConstraint?.preference || '');
  const [notes, setNotes] = useState(existingConstraint?.notes || '');

  const date = new Date(selectedDate);
  const dayOfWeek = getDay(date);
  const isFriday = dayOfWeek === 5;

  return (
    <div className="space-y-4">
      {isFriday && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 text-sm text-blue-700">
          📅 זהו יום שישי - שים לב שכל עובד יכול לעבוד רק שישי אחד בחודש
        </div>
      )}

      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <Switch 
            checked={unavailable} 
            onCheckedChange={setUnavailable}
            className="data-[state=checked]:bg-red-600"
          />
          <div className="flex-1">
            <Label className="text-lg font-bold text-red-700">לא זמין בתאריך זה</Label>
            <p className="text-sm text-red-600 mt-1">סמן אם אינך זמין לעבוד בתאריך זה</p>
            {isFriday && unavailable && (
              <p className="text-xs text-red-700 mt-2 font-bold">
                ✓ לא תשובץ לשום משמרת שישי החודש
              </p>
            )}
          </div>
        </div>
      </div>

      {!unavailable && (
        <div>
          <Label>העדפת משמרת (אופציונלי)</Label>
          <p className="text-xs text-gray-500 mb-2">המערכת תנסה לכבד את ההעדפה אם אפשרי</p>
          <Select value={preference || 'none'} onValueChange={(val) => setPreference(val === 'none' ? '' : val)}>
            <SelectTrigger>
              <SelectValue placeholder="בחר העדפה..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא העדפה</SelectItem>
              <SelectItem value="מעדיף לסיים ב-17:30">מעדיף לסיים ב-17:30</SelectItem>
              <SelectItem value="מעדיף לסיים ב-19:00">מעדיף לסיים ב-19:00</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>הערות</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות נוספות (אופציונלי)"
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        {existingConstraint && (
          <Button variant="destructive" onClick={() => onDelete(existingConstraint.id)}>
            מחק
          </Button>
        )}
        <Button onClick={() => onSave({ unavailable, preference, notes })}>
          שמור
        </Button>
      </div>
    </div>
  );
}

function RangeConstraintForm({ onSave }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unavailable, setUnavailable] = useState(true);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSave(startDate, endDate, { unavailable, preference: '', notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>תאריך התחלה</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="dd/mm/yyyy"
          required
        />
      </div>

      <div>
        <Label>תאריך סיום</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="dd/mm/yyyy"
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={unavailable} onCheckedChange={setUnavailable} />
        <Label>סמן כלא זמין</Label>
      </div>

      <div>
        <Label>סיבה/הערות</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="למשל: חופשה, יציאה מרוכזת, מילואים..."
          rows={3}
        />
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="submit">שמור טווח תאריכים</Button>
      </div>
    </form>
  );
}

function VacationRequestForm({ onSave }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('חופשה');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSave({ start_date: startDate, end_date: endDate, type, notes });
    setStartDate('');
    setEndDate('');
    setNotes('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>תאריך התחלה</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="dd/mm/yyyy"
          required
        />
      </div>

      <div>
        <Label>תאריך סיום</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="dd/mm/yyyy"
          required
        />
      </div>

      <div>
        <Label>סוג היעדרות</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="חופשה">חופשה</SelectItem>
            <SelectItem value="אחר">אחר</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>הערות (אופציונלי)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="פרטים נוספים על הבקשה..."
          rows={3}
        />
      </div>

      <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 text-sm text-blue-700">
        💡 הבקשה תישלח למנהל לאישור. לאחר אישור, התאריכים ישמרו אוטומטית כלא זמין.
      </div>

      <div className="flex gap-3 justify-end">
        <Button type="submit">שלח בקשה למנהל</Button>
      </div>
    </form>
  );
}