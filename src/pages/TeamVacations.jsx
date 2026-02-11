import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';

export default function TeamVacations() {
  const [currentUser, setCurrentUser] = useState(null);

  React.useEffect(() => {
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
    queryFn: () => base44.entities.VacationRequest.list('-start_date'),
  });

  const approvedVacations = vacationRequests.filter(v => v.status === 'אושר');

  // חופשים נוכחיים
  const today = new Date();
  const currentVacations = approvedVacations.filter(v => {
    const start = new Date(v.start_date);
    const end = new Date(v.end_date);
    return isWithinInterval(today, { start, end });
  });

  // חופשים קרובים (7 ימים קדימה)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingVacations = approvedVacations.filter(v => {
    const start = new Date(v.start_date);
    return start > today && start <= nextWeek;
  });

  // כל החופשים העתידיים
  const futureVacations = approvedVacations.filter(v => {
    const end = new Date(v.end_date);
    return end >= today;
  }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const getEmployeeName = (empId) => {
    return employees.find(e => e.id === empId)?.full_name || 'לא ידוע';
  };

  const getDayCount = (vacation) => {
    const start = new Date(vacation.start_date);
    const end = new Date(vacation.end_date);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-green-600" />
            חופשות הצוות
          </h1>
          <Link to={createPageUrl('EmployeeConstraints')}>
            <Button variant="outline">חזרה</Button>
          </Link>
        </div>

        {/* חופשים נוכחיים */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <h2 className="text-xl font-bold">בחופש כעת</h2>
            <Badge className="bg-green-600">{currentVacations.length}</Badge>
          </div>
          {currentVacations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">כל הצוות זמין 👍</p>
          ) : (
            <div className="grid gap-3">
              {currentVacations.map((vacation, idx) => (
                <div key={idx} className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-green-700" />
                        <span className="font-bold text-lg text-green-900">
                          {getEmployeeName(vacation.employee_id)}
                        </span>
                      </div>
                      <div className="text-sm text-green-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(vacation.start_date), 'dd/MM/yyyy')} - {format(new Date(vacation.end_date), 'dd/MM/yyyy')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getDayCount(vacation)} ימים
                        </Badge>
                      </div>
                      {vacation.notes && (
                        <div className="mt-2 text-sm text-green-700 bg-green-100 p-2 rounded">
                          💬 {vacation.notes}
                        </div>
                      )}
                    </div>
                    <Badge className="bg-green-600 text-white">
                      {vacation.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* חופשים קרובים */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <h2 className="text-xl font-bold">השבוע הקרוב</h2>
            <Badge className="bg-orange-600">{upcomingVacations.length}</Badge>
          </div>
          {upcomingVacations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין חופשים מתוכננים בשבוע הקרוב</p>
          ) : (
            <div className="grid gap-3">
              {upcomingVacations.map((vacation, idx) => (
                <div key={idx} className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-orange-700" />
                        <span className="font-bold text-lg text-orange-900">
                          {getEmployeeName(vacation.employee_id)}
                        </span>
                      </div>
                      <div className="text-sm text-orange-800 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(vacation.start_date), 'dd/MM/yyyy')} - {format(new Date(vacation.end_date), 'dd/MM/yyyy')}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getDayCount(vacation)} ימים
                        </Badge>
                      </div>
                      {vacation.notes && (
                        <div className="mt-2 text-sm text-orange-700 bg-orange-100 p-2 rounded">
                          💬 {vacation.notes}
                        </div>
                      )}
                    </div>
                    <Badge className="bg-orange-600 text-white">
                      {vacation.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* כל החופשים העתידיים */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold">כל החופשים המתוכננים</h2>
            <Badge className="bg-blue-600">{futureVacations.length}</Badge>
          </div>
          {futureVacations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין חופשים מתוכננים</p>
          ) : (
            <div className="grid gap-3 max-h-[600px] overflow-y-auto">
              {futureVacations.map((vacation, idx) => {
                const isNow = currentVacations.includes(vacation);
                const isUpcoming = upcomingVacations.includes(vacation);
                
                return (
                  <div 
                    key={idx} 
                    className={`border-2 rounded-lg p-4 ${
                      isNow ? 'bg-green-50 border-green-300' :
                      isUpcoming ? 'bg-orange-50 border-orange-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {isNow && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>}
                          <span className="font-bold text-lg">
                            {getEmployeeName(vacation.employee_id)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(vacation.start_date), 'dd/MM/yyyy')} - {format(new Date(vacation.end_date), 'dd/MM/yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getDayCount(vacation)} ימים
                          </Badge>
                        </div>
                        {vacation.notes && (
                          <div className="mt-2 text-sm text-gray-700 bg-white p-2 rounded border">
                            💬 {vacation.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={
                          isNow ? 'bg-green-600' :
                          isUpcoming ? 'bg-orange-600' :
                          'bg-blue-600'
                        }>
                          {vacation.type}
                        </Badge>
                        {isNow && (
                          <Badge variant="outline" className="text-xs text-green-700 border-green-500">
                            כעת
                          </Badge>
                        )}
                        {isUpcoming && !isNow && (
                          <Badge variant="outline" className="text-xs text-orange-700 border-orange-500">
                            קרוב
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}