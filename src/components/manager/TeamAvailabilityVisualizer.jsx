import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, getDay } from 'date-fns';

export default function TeamAvailabilityVisualizer({ 
  currentMonth, 
  employees, 
  shifts, 
  constraints, 
  vacations 
}) {
  const analysis = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter(d => getDay(d) !== 6); // לא שבת

    const dailyAvailability = days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(date);
      
      // ספור עובדים זמינים
      const unavailable = employees.filter(emp => {
        // אילוץ ספציפי
        const constraint = constraints.find(c => 
          c.employee_id === emp.id && c.date === dateStr && c.unavailable
        );
        if (constraint) return true;

        // חופשה
        const vacation = vacations.find(v => 
          v.employee_id === emp.id && 
          v.status === 'אושר' &&
          dateStr >= v.start_date && 
          dateStr <= v.end_date
        );
        if (vacation) return true;

        return false;
      });

      const available = employees.filter(e => e.active).length - unavailable.length;
      const requiredShifts = dayOfWeek === 5 ? 2 : 2; // שישי או רגיל
      const utilizationRate = available > 0 ? (requiredShifts / available) * 100 : 0;

      return {
        date: dateStr,
        dayOfWeek,
        available,
        unavailable: unavailable.length,
        requiredShifts,
        utilizationRate,
        isCritical: available < requiredShifts,
        isBottleneck: available <= requiredShifts,
      };
    });

    const criticalDays = dailyAvailability.filter(d => d.isCritical);
    const bottleneckDays = dailyAvailability.filter(d => d.isBottleneck);
    const avgAvailability = dailyAvailability.reduce((sum, d) => sum + d.available, 0) / dailyAvailability.length;

    return {
      dailyAvailability,
      criticalDays,
      bottleneckDays,
      avgAvailability,
    };
  }, [currentMonth, employees, shifts, constraints, vacations]);

  const getColorForRate = (rate) => {
    if (rate >= 80) return 'bg-red-500';
    if (rate >= 60) return 'bg-orange-400';
    if (rate >= 40) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            ויזואליזציה - זמינות צוות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* סיכום */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-700">
                {analysis.avgAvailability.toFixed(1)}
              </div>
              <div className="text-sm text-green-600">ממוצע זמינים ליום</div>
            </div>
            <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-700">
                {analysis.bottleneckDays.length}
              </div>
              <div className="text-sm text-orange-600">ימי צוואר בקבוק</div>
            </div>
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-700">
                {analysis.criticalDays.length}
              </div>
              <div className="text-sm text-red-600">ימים קריטיים</div>
            </div>
          </div>

          {/* גרף התפלגות */}
          <div>
            <div className="font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              מפת חום - זמינות יומית
            </div>
            <div className="grid grid-cols-7 gap-1">
              {analysis.dailyAvailability.map((day, idx) => (
                <div
                  key={idx}
                  className={`relative aspect-square rounded ${getColorForRate(day.utilizationRate)} hover:opacity-80 cursor-pointer group`}
                  title={`${format(new Date(day.date + 'T00:00:00'), 'dd/MM')}: ${day.available} זמינים`}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {format(new Date(day.date + 'T00:00:00'), 'd')}
                  </div>
                  {day.isCritical && (
                    <div className="absolute -top-1 -right-1">
                      <AlertTriangle className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {/* Tooltip on hover */}
                  <div className="absolute hidden group-hover:block bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                    <div>{format(new Date(day.date + 'T00:00:00'), 'dd/MM/yyyy')}</div>
                    <div>זמינים: {day.available}/{employees.filter(e => e.active).length}</div>
                    <div>ניצול: {day.utilizationRate.toFixed(0)}%</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-400 rounded"></div>
                <span>זמינות גבוהה</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                <span>זמינות בינונית</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-400 rounded"></div>
                <span>זמינות נמוכה</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>קריטי</span>
              </div>
            </div>
          </div>

          {/* התראות */}
          {analysis.criticalDays.length > 0 && (
            <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
              <div className="font-bold mb-2 flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-5 h-5" />
                ימים קריטיים שדורשים תשומת לב
              </div>
              <div className="space-y-2">
                {analysis.criticalDays.map((day, idx) => (
                  <div key={idx} className="bg-white rounded p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {format(new Date(day.date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">
                          {day.available} זמינים
                        </Badge>
                        <span className="text-xs text-gray-600">
                          נדרשים {day.requiredShifts} לפחות
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}