import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, TrendingUp, Users, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function SwapSuggestionAssistant({ shift, currentEmployee, onSelectEmployee }) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const analyzeSuggestions = async () => {
    setLoading(true);
    try {
      const [employees, allShifts, constraints, metrics, vacations] = await Promise.all([
        base44.entities.Employee.list(),
        base44.entities.Shift.list(),
        base44.entities.Constraint.list(),
        base44.entities.EmployeeMetrics.list(),
        base44.entities.VacationRequest.list(),
      ]);

      // חישוב ציון לכל עובד
      const candidates = employees
        .filter(e => e.active && e.id !== currentEmployee.id)
        .map(emp => {
          let score = 100;
          const empMetrics = metrics.find(m => m.employee_id === emp.id && m.month === format(new Date(), 'yyyy-MM'));
          
          // מדדי ביצועים
          if (empMetrics) {
            score += (empMetrics.reliability_score - 50) * 0.3;
            score += (empMetrics.punctuality_score - 50) * 0.2;
            score -= empMetrics.last_minute_cancellations * 5;
            
            // העדף מי שמקבל בקשות אבל לא מבקש הרבה
            const acceptanceRatio = empMetrics.swap_requests_initiated > 0 
              ? empMetrics.swap_requests_accepted / empMetrics.swap_requests_initiated 
              : 1;
            score += acceptanceRatio * 10;
          }

          // בדוק זמינות
          const constraint = constraints.find(c => 
            c.employee_id === emp.id && c.date === shift.date && c.unavailable
          );
          if (constraint) score -= 1000;

          // בדוק חופשה
          const vacation = vacations.find(v => 
            v.employee_id === emp.id && 
            v.status === 'אושר' &&
            shift.date >= v.start_date && 
            shift.date <= v.end_date
          );
          if (vacation) score -= 1000;

          // העדפות משמרת
          if (emp.preferred_shift_times?.includes(shift.shift_type)) score += 20;
          if (emp.blocked_shift_times?.includes(shift.shift_type)) score -= 50;

          // בדוק עומס משמרות
          const empShifts = allShifts.filter(s => 
            s.assigned_employee_id === emp.id && 
            s.date?.startsWith(format(new Date(), 'yyyy-MM'))
          );
          const avgShifts = allShifts.filter(s => s.assigned_employee_id).length / employees.length;
          if (empShifts.length < avgShifts) score += 15;
          if (empShifts.length > avgShifts) score -= 10;

          // היסטוריה - האם עבד משמרת דומה לאחרונה
          const recentSimilarShifts = empShifts.filter(s => s.shift_type === shift.shift_type).length;
          if (recentSimilarShifts > 0) score += 5;

          return {
            employee: emp,
            score,
            metrics: empMetrics,
            currentShiftCount: empShifts.length,
            available: score > 0,
            reason: constraint ? 'לא זמין' : vacation ? 'בחופשה' : null,
          };
        })
        .filter(c => c.available)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // ניתוח AI מתקדם
      const prompt = `אתה מומחה לניהול משמרות. נתונה משמרת שדורשת החלפה:

**המשמרת:**
- תאריך: ${shift.date}
- סוג: ${shift.shift_type}
- עובד נוכחי: ${currentEmployee.full_name}

**מועמדים אפשריים (5 הטובים ביותר):**
${candidates.map((c, i) => `
${i + 1}. ${c.employee.full_name}
   - ציון כללי: ${c.score.toFixed(1)}
   - משמרות חודש זה: ${c.currentShiftCount}
   - אמינות: ${c.metrics?.reliability_score || 100}%
   - דיוק: ${c.metrics?.punctuality_score || 100}%
   - ביטולים: ${c.metrics?.last_minute_cancellations || 0}
`).join('\n')}

**משימה:**
1. המלץ על 3 המועמדים הטובים ביותר
2. הסבר את ההיגיון מאחורי כל המלצה
3. נתח השפעה על האיזון הכללי של הצוות
4. זהה סיכונים פוטנציאליים

השב בעברית בפורמט JSON.`;

      const aiAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            top_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  employee_name: { type: "string" },
                  reasoning: { type: "string" },
                  pros: { type: "array", items: { type: "string" } },
                  cons: { type: "array", items: { type: "string" } },
                  impact_score: { type: "number" }
                }
              }
            },
            team_impact: {
              type: "object",
              properties: {
                workload_balance: { type: "string" },
                fairness_score: { type: "number" },
                potential_issues: { type: "array", items: { type: "string" } }
              }
            },
            overall_recommendation: { type: "string" }
          }
        }
      });

      setSuggestions({
        candidates,
        aiAnalysis,
      });

    } catch (error) {
      console.error('Error analyzing suggestions:', error);
      toast({ title: 'שגיאה בניתוח', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={analyzeSuggestions}
        disabled={loading}
        className="w-full"
      >
        <Sparkles className="w-4 h-4 ml-2" />
        {loading ? 'מנתח מועמדים...' : 'הצג המלצות AI להחלפה'}
      </Button>

      {suggestions && (
        <div className="space-y-4">
          {/* המלצות AI */}
          {suggestions.aiAnalysis && (
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  ניתוח AI
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {suggestions.aiAnalysis.top_recommendations?.map((rec, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border-2 border-purple-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-lg">{rec.employee_name}</div>
                        <Badge variant="secondary">השפעה: {rec.impact_score}/10</Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const emp = suggestions.candidates.find(
                            c => c.employee.full_name === rec.employee_name
                          );
                          if (emp) onSelectEmployee(emp.employee);
                        }}
                      >
                        בחר
                      </Button>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{rec.reasoning}</p>
                    
                    {rec.pros && rec.pros.length > 0 && (
                      <div className="mb-2">
                        <div className="text-xs font-bold text-green-700">יתרונות:</div>
                        <ul className="text-xs text-green-600 mr-4">
                          {rec.pros.map((pro, i) => <li key={i}>• {pro}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {rec.cons && rec.cons.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-orange-700">חסרונות:</div>
                        <ul className="text-xs text-orange-600 mr-4">
                          {rec.cons.map((con, i) => <li key={i}>• {con}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {suggestions.aiAnalysis.team_impact && (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                    <div className="font-bold mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      השפעה על הצוות
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <strong>איזון עומס:</strong> {suggestions.aiAnalysis.team_impact.workload_balance}
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>ציון הגינות:</strong>
                        <Badge variant={
                          suggestions.aiAnalysis.team_impact.fairness_score >= 8 ? 'default' :
                          suggestions.aiAnalysis.team_impact.fairness_score >= 6 ? 'secondary' :
                          'destructive'
                        }>
                          {suggestions.aiAnalysis.team_impact.fairness_score}/10
                        </Badge>
                      </div>
                      {suggestions.aiAnalysis.team_impact.potential_issues?.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs font-bold text-orange-700">נקודות לתשומת לב:</div>
                          <ul className="text-xs text-orange-600 mr-4">
                            {suggestions.aiAnalysis.team_impact.potential_issues.map((issue, i) => 
                              <li key={i}>⚠️ {issue}</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {suggestions.aiAnalysis.overall_recommendation && (
                  <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-3 text-sm">
                    <strong>המלצה כללית:</strong> {suggestions.aiAnalysis.overall_recommendation}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* רשימת כל המועמדים */}
          <Card>
            <CardHeader>
              <CardTitle>כל המועמדים המתאימים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.candidates.map((candidate, idx) => (
                <div
                  key={candidate.employee.id}
                  className="border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">#{idx + 1}</span>
                        <span className="font-medium">{candidate.employee.full_name}</span>
                        <Badge variant="outline">ציון: {candidate.score.toFixed(0)}</Badge>
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center gap-4">
                          <span>📊 משמרות: {candidate.currentShiftCount}</span>
                          {candidate.metrics && (
                            <>
                              <span>✅ אמינות: {candidate.metrics.reliability_score}%</span>
                              <span>🕐 דיוק: {candidate.metrics.punctuality_score}%</span>
                            </>
                          )}
                        </div>
                        {candidate.employee.preferred_shift_times?.includes(shift.shift_type) && (
                          <Badge variant="secondary" className="text-xs">מעדיף משמרת זו</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectEmployee(candidate.employee)}
                    >
                      בחר
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}