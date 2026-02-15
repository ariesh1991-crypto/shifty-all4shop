import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Sparkles, Award } from 'lucide-react';
import { format } from 'date-fns';

export default function EmployeePerformanceAnalytics({ currentMonth }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const monthKey = format(currentMonth, 'yyyy-MM');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['metrics', monthKey],
    queryFn: async () => {
      const all = await base44.entities.EmployeeMetrics.list();
      return all.filter(m => m.month === monthKey);
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Shift.list();
      return all.filter(s => s.date?.startsWith(monthKey));
    },
  });

  const analyzePerformance = async () => {
    setLoading(true);
    try {
      const employeesWithMetrics = employees
        .filter(e => e.active)
        .map(emp => {
          const empMetrics = metrics.find(m => m.employee_id === emp.id) || {
            punctuality_score: 100,
            reliability_score: 100,
            swap_requests_initiated: 0,
            swap_requests_accepted: 0,
            last_minute_cancellations: 0,
            total_shifts_completed: 0,
          };

          const empShifts = shifts.filter(s => s.assigned_employee_id === emp.id);
          const swapAcceptanceRatio = empMetrics.swap_requests_initiated > 0
            ? (empMetrics.swap_requests_accepted / empMetrics.swap_requests_initiated) * 100
            : 100;

          return {
            name: emp.full_name,
            ...empMetrics,
            shift_count: empShifts.length,
            swap_acceptance_ratio: swapAcceptanceRatio,
          };
        });

      const prompt = `אתה מומחה לניתוח ביצועים וניהול משאבי אנוש. נתונים על צוות של ${employeesWithMetrics.length} עובדים:

**נתוני עובדים:**
${employeesWithMetrics.map((emp, i) => `
${i + 1}. ${emp.name}
   - משמרות שהושלמו: ${emp.total_shifts_completed}
   - ציון דיוק: ${emp.punctuality_score}%
   - ציון אמינות: ${emp.reliability_score}%
   - בקשות החלפה יזם: ${emp.swap_requests_initiated}
   - בקשות החלפה קיבל: ${emp.swap_requests_accepted}
   - יחס קבלה: ${emp.swap_acceptance_ratio.toFixed(1)}%
   - ביטולים ברגע אחרון: ${emp.last_minute_cancellations}
   - משמרות חודש זה: ${emp.shift_count}
`).join('\n')}

**משימה:**
1. זהה את 3 העובדים המצטיינים והסבר למה
2. זהה עובדים שדורשים תשומת לב ואת הסיבות
3. המלץ על תחומים לפיתוח לכל עובד שזקוק לשיפור
4. זהה מגמות חיוביות ושליליות בצוות
5. הצע המלצות פעולה קונקרטיות למנהל

השב בעברית בפורמט JSON.`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            top_performers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  recognition: { type: "string" },
                  score: { type: "number" }
                }
              }
            },
            needs_attention: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  issues: { type: "array", items: { type: "string" } },
                  development_areas: { type: "array", items: { type: "string" } },
                  coaching_suggestions: { type: "array", items: { type: "string" } },
                  severity: { type: "string", enum: ["low", "medium", "high"] }
                }
              }
            },
            team_trends: {
              type: "object",
              properties: {
                positive: { type: "array", items: { type: "string" } },
                negative: { type: "array", items: { type: "string" } },
                overall_health: { type: "string" }
              }
            },
            action_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  timeline: { type: "string" }
                }
              }
            }
          }
        }
      });

      setAnalysis({
        employeesData: employeesWithMetrics,
        aiInsights: aiAnalysis,
      });

    } catch (error) {
      console.error('Performance analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            ניתוח ביצועי עובדים - AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={analyzePerformance}
            disabled={loading}
            className="w-full"
          >
            <Sparkles className="w-4 h-4 ml-2" />
            {loading ? 'מנתח נתוני ביצועים...' : 'הפעל ניתוח AI'}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Tabs defaultValue="top_performers" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="top_performers">מצטיינים</TabsTrigger>
            <TabsTrigger value="needs_attention">דורשים תשומת לב</TabsTrigger>
            <TabsTrigger value="trends">מגמות</TabsTrigger>
            <TabsTrigger value="actions">פעולות מומלצות</TabsTrigger>
          </TabsList>

          <TabsContent value="top_performers" className="space-y-3">
            {analysis.aiInsights.top_performers?.map((emp, idx) => (
              <Card key={idx} className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Award className="w-8 h-8 text-green-600" />
                      <div>
                        <div className="text-xl font-bold">{emp.name}</div>
                        <Badge variant="default" className="bg-green-600 mt-1">
                          ציון: {emp.score}/100
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white bg-opacity-70 rounded-lg p-3 mb-3">
                    <div className="font-bold text-sm mb-2">נקודות חוזק:</div>
                    <ul className="text-sm space-y-1">
                      {emp.strengths?.map((strength, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-green-100 rounded-lg p-3 text-sm">
                    <strong>המלצה להכרה:</strong> {emp.recognition}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="needs_attention" className="space-y-3">
            {analysis.aiInsights.needs_attention?.map((emp, idx) => {
              const severityConfig = {
                high: { bg: 'from-red-50 to-red-100', border: 'border-red-500', icon: 'text-red-600' },
                medium: { bg: 'from-orange-50 to-orange-100', border: 'border-orange-500', icon: 'text-orange-600' },
                low: { bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-500', icon: 'text-yellow-600' },
              };
              const config = severityConfig[emp.severity] || severityConfig.medium;

              return (
                <Card key={idx} className={`bg-gradient-to-br ${config.bg} border-2 ${config.border}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <AlertCircle className={`w-8 h-8 ${config.icon}`} />
                        <div>
                          <div className="text-xl font-bold">{emp.name}</div>
                          <Badge variant={emp.severity === 'high' ? 'destructive' : 'secondary'}>
                            {emp.severity === 'high' ? 'דחוף' : emp.severity === 'medium' ? 'בינוני' : 'קל'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-white bg-opacity-70 rounded-lg p-3">
                        <div className="font-bold text-sm mb-2">נושאים:</div>
                        <ul className="text-sm space-y-1">
                          {emp.issues?.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-red-500">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-white bg-opacity-70 rounded-lg p-3">
                        <div className="font-bold text-sm mb-2">תחומים לפיתוח:</div>
                        <ul className="text-sm space-y-1">
                          {emp.development_areas?.map((area, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-blue-500">→</span>
                              <span>{area}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-white bg-opacity-70 rounded-lg p-3">
                        <div className="font-bold text-sm mb-2">הצעות לליווי:</div>
                        <ul className="text-sm space-y-1">
                          {emp.coaching_suggestions?.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-purple-500">💡</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="trends" className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">מגמות בצוות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 border-2 border-green-400 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div className="font-bold">מגמות חיוביות</div>
                  </div>
                  <ul className="space-y-2">
                    {analysis.aiInsights.team_trends?.positive?.map((trend, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {analysis.aiInsights.team_trends?.negative?.length > 0 && (
                  <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                      <div className="font-bold">מגמות שליליות</div>
                    </div>
                    <ul className="space-y-2">
                      {analysis.aiInsights.team_trends.negative.map((trend, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <span>{trend}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
                  <div className="font-bold mb-2">מצב כללי:</div>
                  <p className="text-sm">{analysis.aiInsights.team_trends?.overall_health}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-2">
            {analysis.aiInsights.action_items?.map((item, idx) => {
              const priorityConfig = {
                high: { bg: 'bg-red-50', border: 'border-red-400', badge: 'destructive' },
                medium: { bg: 'bg-orange-50', border: 'border-orange-400', badge: 'secondary' },
                low: { bg: 'bg-blue-50', border: 'border-blue-400', badge: 'outline' },
              };
              const config = priorityConfig[item.priority] || priorityConfig.medium;

              return (
                <div key={idx} className={`${config.bg} border-2 ${config.border} rounded-lg p-4`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.action}</div>
                      <div className="text-sm text-gray-600 mt-1">⏱️ {item.timeline}</div>
                    </div>
                    <Badge variant={config.badge}>
                      {item.priority === 'high' ? 'עדיפות גבוהה' :
                       item.priority === 'medium' ? 'עדיפות בינונית' :
                       'עדיפות נמוכה'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}