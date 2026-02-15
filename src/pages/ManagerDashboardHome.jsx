import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, AlertCircle, CheckCircle, Clock, TrendingUp, ArrowRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import NotificationBell from '../components/notifications/NotificationBell';

export default function ManagerDashboardHome() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };
    loadUser();
  }, []);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['vacationRequests'],
    queryFn: () => base44.entities.VacationRequest.list('-created_date'),
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints'],
    queryFn: () => base44.entities.Constraint.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => base44.entities.Shift.list(),
  });

  const { data: swapRequests = [] } = useQuery({
    queryKey: ['swapRequests'],
    queryFn: () => base44.entities.SwapRequest.list(),
  });

  const { data: recurringConstraints = [] } = useQuery({
    queryKey: ['recurringConstraints'],
    queryFn: () => base44.entities.RecurringConstraint.list(),
  });

  const activeEmployees = employees.filter(e => e.active).length;
  const pendingVacations = vacationRequests.filter(v => v.status === 'ממתין לאישור').length;
  const pendingSwaps = swapRequests.filter(s => s.status === 'ממתין לאישור').length;
  const pendingRecurring = recurringConstraints.filter(rc => rc.status === 'ממתין לאישור').length;

  const problematicShifts = shifts.filter(s => s.status === 'בעיה').length;
  const unassignedShifts = shifts.filter(s => !s.assigned_employee_id && s.status !== 'בעיה').length;

  const upcomingVacations = vacationRequests.filter(v => {
    if (v.status !== 'אושר') return false;
    const startDate = parseISO(v.start_date);
    const today = new Date();
    const sevenDaysFromNow = addDays(today, 7);
    return isBefore(today, startDate) && isBefore(startDate, sevenDaysFromNow);
  });

  const thisMonth = format(new Date(), 'yyyy-MM');
  const monthlyUnavailable = constraints.filter(c => 
    c.date && c.date.startsWith(thisMonth) && c.unavailable
  ).length;

  const approvedRecurring = recurringConstraints.filter(rc => rc.status === 'אושר').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">לוח בקרה מנהל</h1>
            <p className="text-gray-600 mt-2">סקירה כללית של מערכת ניהול המשמרות</p>
          </div>
          <div className="flex gap-3">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button>
                <Calendar className="w-4 h-4 ml-2" />
                לוח משמרות מלא
              </Button>
            </Link>
            <Link to={createPageUrl('EmployeeShiftsReport')}>
              <Button variant="outline">
                📊 דוח עובדים
              </Button>
            </Link>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">עובדים פעילים</CardTitle>
              <Users className="w-5 h-5 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeEmployees}</div>
              <p className="text-xs opacity-80 mt-1">מתוך {employees.length} סה״כ</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">בקשות ממתינות</CardTitle>
              <Clock className="w-5 h-5 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingVacations + pendingSwaps + pendingRecurring}</div>
              <p className="text-xs opacity-80 mt-1">
                {pendingVacations} חופשות • {pendingSwaps} החלפות • {pendingRecurring} אילוצים
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">משמרות בעייתיות</CardTitle>
              <AlertCircle className="w-5 h-5 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{problematicShifts + unassignedShifts}</div>
              <p className="text-xs opacity-80 mt-1">
                {problematicShifts} בעיות • {unassignedShifts} לא משובצות
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">חופשות קרובות</CardTitle>
              <TrendingUp className="w-5 h-5 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{upcomingVacations.length}</div>
              <p className="text-xs opacity-80 mt-1">ב-7 הימים הקרובים</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                פעולות דרושות
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingVacations > 0 && (
                <Link to={createPageUrl('VacationManagement')}>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg hover:bg-amber-100 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      <div>
                        <div className="font-medium">{pendingVacations} בקשות חופשה ממתינות</div>
                        <div className="text-sm text-gray-600">דורש אישור</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              )}

              {pendingSwaps > 0 && (
                <div 
                  onClick={() => window.location.href = createPageUrl('ManagerDashboard')}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div>
                      <div className="font-medium">{pendingSwaps} בקשות החלפה ממתינות</div>
                      <div className="text-sm text-gray-600">דורש אישור</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              )}

              {pendingRecurring > 0 && (
                <Link to={createPageUrl('RecurringConstraints')}>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                      <div>
                        <div className="font-medium">{pendingRecurring} אילוצים קבועים ממתינים</div>
                        <div className="text-sm text-gray-600">דורש אישור</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              )}

              {problematicShifts > 0 && (
                <div 
                  onClick={() => window.location.href = createPageUrl('ManagerDashboard')}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div>
                      <div className="font-medium">{problematicShifts} משמרות בעייתיות</div>
                      <div className="text-sm text-gray-600">דורש טיפול</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              )}

              {pendingVacations === 0 && pendingSwaps === 0 && pendingRecurring === 0 && problematicShifts === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>אין פעולות ממתינות 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-500" />
                חופשות קרובות (7 ימים)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingVacations.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {upcomingVacations.map(v => {
                    const employee = employees.find(e => e.id === v.employee_id);
                    return (
                      <div key={v.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-green-900">{employee?.full_name}</div>
                            <div className="text-sm text-green-700 mt-1">
                              {format(parseISO(v.start_date), 'dd/MM')} - {format(parseISO(v.end_date), 'dd/MM')}
                            </div>
                            <Badge variant="secondary" className="mt-1 text-xs">{v.type}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>אין חופשות מתוכננות בשבוע הקרוב</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>סיכום אילוצים - חודש נוכחי</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">{monthlyUnavailable}</div>
                <div className="text-sm text-gray-600 mt-1">ימי אי-זמינות</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-3xl font-bold text-orange-600">{approvedRecurring}</div>
                <div className="text-sm text-gray-600 mt-1">אילוצים קבועים פעילים</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {constraints.filter(c => c.date && c.date.startsWith(thisMonth) && c.preference).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">העדפות משמרות</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}