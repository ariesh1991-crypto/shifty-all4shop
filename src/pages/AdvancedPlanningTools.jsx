import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, getMonth, getYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import WhatIfSimulator from '../components/manager/WhatIfSimulator';
import TeamAvailabilityVisualizer from '../components/manager/TeamAvailabilityVisualizer';
import RealTimeAlertsPanel from '../components/notifications/RealTimeAlertsPanel';

export default function AdvancedPlanningTools() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const year = getYear(currentDate);
  const month = getMonth(currentDate) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Shift.list();
      return all.filter(s => s.date?.startsWith(monthKey));
    },
  });

  const { data: constraints = [] } = useQuery({
    queryKey: ['constraints', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Constraint.list();
      return all.filter(c => c.date?.startsWith(monthKey));
    },
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ['vacations'],
    queryFn: () => base44.entities.VacationRequest.list(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold">כלי תכנון מתקדמים</h1>
          </div>
          <div className="flex gap-2">
            <RealTimeAlertsPanel isManager={true} />
            <Link to={createPageUrl('ManagerDashboard')}>
              <Button variant="outline">
                <ArrowRight className="w-4 h-4 ml-2" />
                חזרה
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="simulator" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="simulator">סימולטור What-If</TabsTrigger>
            <TabsTrigger value="visualizer">מפת זמינות צוות</TabsTrigger>
            <TabsTrigger value="ai-suggestions">הצעות AI אוטומטיות</TabsTrigger>
          </TabsList>

          <TabsContent value="simulator">
            <WhatIfSimulator
              currentMonth={currentDate}
              employees={employees}
              shifts={shifts}
              constraints={constraints}
              vacations={vacations}
            />
          </TabsContent>

          <TabsContent value="visualizer">
            <TeamAvailabilityVisualizer
              currentMonth={currentDate}
              employees={employees}
              shifts={shifts}
              constraints={constraints}
              vacations={vacations}
            />
          </TabsContent>

          <TabsContent value="ai-suggestions">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4">הצעות AI אוטומטיות לשיבוץ</h3>
              <p className="text-gray-600">
                תכונה זו מציגה המלצות חכמות לשיבוץ משמרות בזמן אמת
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}