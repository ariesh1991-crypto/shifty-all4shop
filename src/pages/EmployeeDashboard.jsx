import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear, getDay, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Briefcase, ArrowLeftRight, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import NotificationBell from '../components/notifications/NotificationBell';
import MonthCalendar from '../components/shifts/MonthCalendar';
import { useToast } from '@/components/ui/use-toast';
import SwapSuggestionAssistant from '../components/ai/SwapSuggestionAssistant';

export default function EmployeeDashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

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

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const allShifts = await base44.entities.Shift.list();
      return allShifts.filter(s => 
        s.assigned_employee_id === currentEmployee.id && 
        s.date?.startsWith(monthKey)
      );
    },
    enabled: !!currentEmployee,
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['allShifts', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Shift.list();
      return all.filter(s => s.date?.startsWith(monthKey));
    },
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ['vacations', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.VacationRequest.list('-created_date');
      return all.filter(v => v.employee_id === currentEmployee.id);
    },
    enabled: !!currentEmployee,
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', currentEmployee?.id, monthKey],
    queryFn: async () => {
      if (!currentEmployee) return [];
      const all = await base44.entities.Constraint.list();
      return all.filter(c => 
        c.employee_id === currentEmployee.id && 
        c.date?.startsWith(monthKey)
      );
    },
    enabled: !!currentEmployee,
  });

  const createVacationMutation = useMutation({
    mutationFn: (data) => base44.entities.VacationRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['vacations']);
      toast({ title: 'בקשת חופשה נשלחה' });
      setVacationDialogOpen(false);
    },
  });

  // חישוב נתונים לשבוע הנוכחי
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  const thisWeekShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date + 'T00:00:00');
    return shiftDate >= weekStart && shiftDate <= weekEnd;
  });

  const nextWeekStart = addWeeks(weekStart, 1);
  const nextWeekEnd = addWeeks(weekEnd, 1);
  const nextWeekShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date + 'T00:00:00');
    return shiftDate >= nextWeekStart && shiftDate <= nextWeekEnd;
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const approvedVacationsThisMonth = vacations.filter(v => 
    v.status === 'אושר' &&
    v.start_date <= format(monthEnd, 'yyyy-MM-dd') &&
    v.end_date >= format(monthStart, 'yyyy-MM-dd')
  );

  const pendingVacations = vacations.filter(v => v.status === 'ממתין לאישור');

  const renderDay = (date) => {
    const dayOfWeek = getDay(date);
    if (dayOfWeek === 6) return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    const dayNumber = format(date, 'd');
    const constraint = constraints.find(c => c.date === dateStr);
    const vacation = approvedVacationsThisMonth.find(v => 
      dateStr >= v.start_date && dateStr <= v.end_date
    );

    const SHIFT_COLORS = {
      'מסיים ב-17:30': 'bg-blue-200 border-blue-500',
      'מסיים ב-19:00': 'bg-purple-200 border-purple-500',
      'שישי קצר': 'bg-yellow-200 border-yellow-500',
      'שישי ארוך': 'bg-orange-200 border-orange-500',
    };

    return (
      <div
        key={date.toString()}
        className={`p-3 border-2 rounded-lg min-h-[100px] ${
          vacation ? 'bg-green-100 border-green-500' :
          constraint?.unavailable ? 'bg-red-100 border-red-400' :
          dayShifts.length > 0 ? 'bg-white' : 'bg-gray-50'
        }`}
      >
        <div className="font-bold text-center mb-2">{dayNumber}</div>
        
        {vacation && (
          <div className="text-xs p-2 bg-green-200 border-2 border-green-600 rounded mb-1 text-center">
            <div className="font-bold text-green-800">🏖️ {vacation.type}</div>
            <div className="text-green-700 text-[10px]">מאושר</div>
          </div>
        )}

        {constraint?.unavailable && !vacation && (
          <div className="text-xs p-2 bg-red-200 border-2 border-red-500 rounded mb-1 text-center">
            <div className="font-bold text-red-800">❌ לא זמין</div>
            {constraint.notes && (
              <div className="text-red-700 text-[10px]">{constraint.notes}</div>
            )}
          </div>
        )}

        {constraint?.preference && !constraint.unavailable && (
          <div className="text-xs p-1 bg-blue-100 border border-blue-400 rounded mb-1 text-center">
            <div className="text-blue-700 text-[10px]">⭐ {constraint.preference}</div>
          </div>
        )}

        <div className="space-y-1">
          {dayShifts.map((shift) => (
            <div
              key={shift.id}
              className={`text-xs p-2 rounded border-2 ${SHIFT_COLORS[shift.shift_type]}`}
            >
              <div className="font-bold text-center">{shift.shift_type}</div>
              {shift.start_time && shift.end_time && (
                <div className="text-center text-[10px] text-gray-700 mt-1">
                  {shift.start_time} - {shift.end_time}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold">שלום, {currentEmployee.full_name}</h1>
          <div className="flex gap-2 flex-wrap">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Link to={createPageUrl('EmployeeConstraints')}>
              <Button variant="outline">⚙️ העדפות</Button>
            </Link>
            <Link to={createPageUrl('EmployeeShifts')}>
              <Button variant="outline">
                <Calendar className="w-4 h-4 ml-2" />
                משמרות
              </Button>
            </Link>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        {/* סיכום מהיר */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                השבוע
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{thisWeekShifts.length}/3</div>
              <p className="text-xs text-gray-500 mt-1">משמרות</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                שבוע הבא
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{nextWeekShifts.length}</div>
              <p className="text-xs text-gray-500 mt-1">משמרות מתוכננות</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                החודש
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{shifts.length}</div>
              <p className="text-xs text-gray-500 mt-1">סה״כ משמרות</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                חופשות
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {approvedVacationsThisMonth.length}
                  </div>
                  <p className="text-xs text-gray-500">מאושרות</p>
                </div>
                {pendingVacations.length > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {pendingVacations.length}
                    </div>
                    <p className="text-xs text-gray-500">ממתינות</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* פעולות מהירות */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setVacationDialogOpen(true)}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold mb-1">🏖️ בקש חופשה</div>
                  <p className="text-sm text-gray-700">הגש בקשה למנהל לאישור</p>
                </div>
                <Briefcase className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 cursor-pointer hover:shadow-lg transition-all"
                onClick={() => setSwapDialogOpen(true)}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold mb-1">🔄 החלף משמרת</div>
                  <p className="text-sm text-gray-700">הצע החלפה עם עובד אחר</p>
                </div>
                <ArrowLeftRight className="w-12 h-12 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* סטטוס בקשות */}
        {(pendingVacations.length > 0 || approvedVacationsThisMonth.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>סטטוס בקשות חופשה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingVacations.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-yellow-50 border-2 border-yellow-400 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <div>
                      <div className="font-medium">{v.type}</div>
                      <div className="text-sm text-gray-600">
                        {format(new Date(v.start_date + 'T00:00:00'), 'dd/MM/yyyy')} - {format(new Date(v.end_date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">ממתין</Badge>
                </div>
              ))}
              
              {approvedVacationsThisMonth.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-green-50 border-2 border-green-400 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium">{v.type}</div>
                      <div className="text-sm text-gray-600">
                        {format(new Date(v.start_date + 'T00:00:00'), 'dd/MM/yyyy')} - {format(new Date(v.end_date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600">מאושר</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* לוח שנה */}
        <Card>
          <CardHeader>
            <CardTitle>לוח משמרות - {format(currentDate, 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="font-bold mb-2">מקרא:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-200 border-2 border-blue-500 rounded"></div>
                  <span>מסיים 17:30</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-purple-200 border-2 border-purple-500 rounded"></div>
                  <span>מסיים 19:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-100 border-2 border-green-500 rounded"></div>
                  <span>חופשה מאושרת</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-red-100 border-2 border-red-400 rounded"></div>
                  <span>לא זמין</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-100 border border-blue-400 rounded"></div>
                  <span>העדפה אישית</span>
                </div>
              </div>
            </div>
            <MonthCalendar year={year} month={month} renderDay={renderDay} />
          </CardContent>
        </Card>

        {/* דיאלוג בקשת חופשה */}
        <Dialog open={vacationDialogOpen} onOpenChange={setVacationDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>בקשת חופשה חדשה</DialogTitle>
            </DialogHeader>
            <VacationRequestForm
              onSubmit={(data) => createVacationMutation.mutate({
                ...data,
                employee_id: currentEmployee.id,
              })}
            />
          </DialogContent>
        </Dialog>

        {/* דיאלוג החלפת משמרת */}
        <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
          <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>בקשת החלפת משמרת</DialogTitle>
            </DialogHeader>
            <SwapRequestFormEnhanced
              shifts={shifts}
              allShifts={allShifts}
              currentEmployee={currentEmployee}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function VacationRequestForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    type: 'חופשה',
    notes: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>מתאריך</Label>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>עד תאריך</Label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label>סוג</Label>
        <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
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
        <Label>הערות</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full">שלח בקשה</Button>
    </form>
  );
}

function SwapRequestFormEnhanced({ shifts, allShifts, currentEmployee }) {
  const [selectedShift, setSelectedShift] = useState('');
  const [targetEmployee, setTargetEmployee] = useState('');
  const [showAI, setShowAI] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <Label>המשמרת שלי שאני רוצה להחליף</Label>
        <Select value={selectedShift} onValueChange={setSelectedShift}>
          <SelectTrigger>
            <SelectValue placeholder="בחר משמרת..." />
          </SelectTrigger>
          <SelectContent>
            {shifts.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {format(new Date(s.date + 'T00:00:00'), 'dd/MM/yyyy')} - {s.shift_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedShift && (
        <SwapSuggestionAssistant
          shift={shifts.find(s => s.id === selectedShift)}
          currentEmployee={currentEmployee}
          onSelectEmployee={(emp) => setTargetEmployee(emp.id)}
        />
      )}
    </div>
  );
}