import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays, isBefore, isAfter } from 'date-fns';
import { Calendar, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function UpcomingVacationAlerts({ employeeId }) {
  const { data: vacationRequests = [] } = useQuery({
    queryKey: ['upcomingVacations', employeeId],
    queryFn: async () => {
      const all = await base44.entities.VacationRequest.list();
      return all.filter(v => v.employee_id === employeeId);
    },
    enabled: !!employeeId,
  });

  const today = new Date();
  
  // חופשות קרובות (7-30 ימים)
  const upcomingVacations = vacationRequests.filter(v => {
    if (!v.start_date) return false;
    try {
      const startDate = parseISO(v.start_date);
      const daysUntil = differenceInDays(startDate, today);
      return daysUntil >= 0 && daysUntil <= 30;
    } catch (e) {
      return false;
    }
  });

  // חופשות ממתינות לאישור שמתחילות בעוד פחות מ-14 ימים
  const urgentPending = upcomingVacations.filter(v => {
    if (!v.start_date) return false;
    try {
      const startDate = parseISO(v.start_date);
      const daysUntil = differenceInDays(startDate, today);
      return v.status === 'ממתין לאישור' && daysUntil <= 14;
    } catch (e) {
      return false;
    }
  });

  if (upcomingVacations.length === 0) return null;

  return (
    <div className="space-y-3">
      {urgentPending.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-amber-900">
              יש לך {urgentPending.length} בקשות חופשה דחופות ממתינות לאישור!
            </span>
          </div>
          {urgentPending.map(v => {
            try {
              const daysUntil = differenceInDays(parseISO(v.start_date), today);
              return (
                <div key={v.id} className="text-sm text-amber-800 mt-2">
                  • {v.type} - {format(parseISO(v.start_date), 'dd/MM')} (בעוד {daysUntil} ימים)
                </div>
              );
            } catch (e) {
              return null;
            }
          })}
        </div>
      )}

      {upcomingVacations.filter(v => v.status === 'אושר').length > 0 && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-green-600" />
            <span className="font-bold text-green-900">חופשות מתוכננות</span>
          </div>
          <div className="space-y-2">
            {upcomingVacations
              .filter(v => v.status === 'אושר' && v.start_date)
              .sort((a, b) => {
                try {
                  return parseISO(a.start_date) - parseISO(b.start_date);
                } catch (e) {
                  return 0;
                }
              })
              .map(v => {
                try {
                  const daysUntil = differenceInDays(parseISO(v.start_date), today);
                  return (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{v.type}</span>
                        <span className="text-gray-600 mr-2">
                          {format(parseISO(v.start_date), 'dd/MM')} - {format(parseISO(v.end_date), 'dd/MM')}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {daysUntil === 0 ? 'היום!' : 
                         daysUntil === 1 ? 'מחר' : 
                         `בעוד ${daysUntil} ימים`}
                      </Badge>
                    </div>
                  );
                } catch (e) {
                  return null;
                }
              })}
          </div>
        </div>
      )}
    </div>
  );
}