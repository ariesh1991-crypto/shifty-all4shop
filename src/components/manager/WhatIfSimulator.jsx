import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, TrendingUp, AlertTriangle, CheckCircle, Users, Calendar } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';

export default function WhatIfSimulator({ currentMonth, employees, shifts, constraints, vacations }) {
  const [scenarioType, setScenarioType] = useState('vacation');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [running, setRunning] = useState(false);

  const runSimulation = async () => {
    setRunning(true);
    try {
      let scenarioDescription = '';
      let affectedShifts = [];
      let affectedEmployees = new Set();

      if (scenarioType === 'vacation') {
        // סימולציה של אישור חופשה
        scenarioDescription = `אישור חופשה ל${employees.find(e => e.id === selectedEmployee)?.full_name} מ-${format(new Date(startDate), 'dd/MM')} עד ${format(new Date(endDate), 'dd/MM')}`;
        
        const dates = eachDayOfInterval({ 
          start: new Date(startDate), 
          end: new Date(endDate) 
        });

        affectedShifts = shifts.filter(s => 
          s.assigned_employee_id === selectedEmployee &&
          dates.some(d => format(d, 'yyyy-MM-dd') === s.date)
        );

        affectedEmployees.add(selectedEmployee);
      }

      // ניתוח השפעה עם AI
      const prompt = `אתה מומחה לניהול משמרות. נתון תרחיש היפותטי:

**תרחיש:** ${scenarioDescription}

**משמרות מושפעות:** ${affectedShifts.length} משמרות
${affectedShifts.slice(0, 5).map(s => `- ${s.date}: ${s.shift_type}`).join('\n')}

**עובדים פעילים:** ${employees.filter(e => e.active).length}

**אילוצים קיימים:** ${constraints.filter(c => c.unavailable).length}

**נתח:**
1. חומרת ההשפעה (קלה/בינונית/חמורה)
2. משמרות שיהיו ללא כיסוי
3. העובדים שיושפעו מהפצה מחדש
4. המלצות לפתרון
5. סיכונים אפשריים

השב בעברית בפורמט JSON.`;

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            severity: {
              type: "string",
              enum: ["low", "medium", "high"]
            },
            impact_summary: { type: "string" },
            uncovered_shifts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  shift_type: { type: "string" },
                  difficulty: { type: "string" }
                }
              }
            },
            affected_employees_redistribution: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  employee_name: { type: "string" },
                  additional_shifts: { type: "number" },
                  workload_increase: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: { type: "string" }
            },
            potential_risks: {
              type: "array",
              items: { type: "string" }
            },
            alternative_solutions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  solution: { type: "string" },
                  feasibility: { type: "string" }
                }
              }
            }
          }
        }
      });

      setSimulation({
        scenario: scenarioDescription,
        affectedShiftsCount: affectedShifts.length,
        affectedShifts,
        analysis,
      });

    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setRunning(false);
    }
  };

  const severityConfig = {
    low: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-400', label: 'השפעה קלה' },
    medium: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-400', label: 'השפעה בינונית' },
    high: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-400', label: 'השפעה חמורה' },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            סימולטור What-If
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>סוג תרחיש</Label>
            <Select value={scenarioType} onValueChange={setScenarioType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">אישור בקשת חופשה</SelectItem>
                <SelectItem value="absence">העדרות פתאומית</SelectItem>
                <SelectItem value="shift_change">שינוי שעות משמרת</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scenarioType === 'vacation' && (
            <>
              <div>
                <Label>עובד</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר עובד..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.active).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>מתאריך</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>עד תאריך</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <Button
            onClick={runSimulation}
            disabled={running || !selectedEmployee || !startDate || !endDate}
            className="w-full"
          >
            <Play className="w-4 h-4 ml-2" />
            {running ? 'מריץ סימולציה...' : 'הרץ סימולציה'}
          </Button>
        </CardContent>
      </Card>

      {simulation && simulation.analysis && (
        <Card className={`border-2 ${severityConfig[simulation.analysis.severity]?.border || ''}`}>
          <CardHeader className={severityConfig[simulation.analysis.severity]?.bg}>
            <CardTitle className="flex items-center justify-between">
              <span>תוצאות סימולציה</span>
              <Badge variant={
                simulation.analysis.severity === 'low' ? 'default' :
                simulation.analysis.severity === 'medium' ? 'secondary' :
                'destructive'
              }>
                {severityConfig[simulation.analysis.severity]?.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="font-bold mb-2">תיאור תרחיש:</div>
              <p className="text-sm">{simulation.scenario}</p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="font-bold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                סיכום השפעה
              </div>
              <p className="text-sm">{simulation.analysis.impact_summary}</p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <Badge variant="outline">
                  <Calendar className="w-3 h-3 ml-1" />
                  {simulation.affectedShiftsCount} משמרות מושפעות
                </Badge>
              </div>
            </div>

            <Tabs defaultValue="uncovered" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="uncovered">משמרות ללא כיסוי</TabsTrigger>
                <TabsTrigger value="redistribution">הפצה מחדש</TabsTrigger>
                <TabsTrigger value="recommendations">המלצות</TabsTrigger>
                <TabsTrigger value="risks">סיכונים</TabsTrigger>
              </TabsList>

              <TabsContent value="uncovered" className="space-y-2">
                {simulation.analysis.uncovered_shifts?.length > 0 ? (
                  simulation.analysis.uncovered_shifts.map((shift, idx) => (
                    <div key={idx} className="border rounded p-3 bg-red-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{shift.shift_type}</div>
                          <div className="text-sm text-gray-600">
                            {format(new Date(shift.date + 'T00:00:00'), 'dd/MM/yyyy')}
                          </div>
                        </div>
                        <Badge variant={
                          shift.difficulty === 'קשה' ? 'destructive' :
                          shift.difficulty === 'בינוני' ? 'secondary' :
                          'outline'
                        }>
                          {shift.difficulty}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-green-600">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>כל המשמרות יכוסו</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="redistribution" className="space-y-2">
                {simulation.analysis.affected_employees_redistribution?.map((emp, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{emp.employee_name}</span>
                      <Badge variant="secondary">+{emp.additional_shifts} משמרות</Badge>
                    </div>
                    <div className="text-sm text-gray-600">{emp.workload_increase}</div>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-2">
                {simulation.analysis.recommendations?.map((rec, idx) => (
                  <div key={idx} className="bg-green-50 border-2 border-green-300 rounded p-3 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </div>
                ))}
                
                {simulation.analysis.alternative_solutions?.length > 0 && (
                  <div className="mt-4">
                    <div className="font-bold mb-2">פתרונות אלטרנטיביים:</div>
                    {simulation.analysis.alternative_solutions.map((sol, idx) => (
                      <div key={idx} className="bg-blue-50 border border-blue-300 rounded p-3 mb-2">
                        <div className="text-sm font-medium mb-1">{sol.solution}</div>
                        <Badge variant="outline" className="text-xs">{sol.feasibility}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risks" className="space-y-2">
                {simulation.analysis.potential_risks?.map((risk, idx) => (
                  <div key={idx} className="bg-orange-50 border-2 border-orange-300 rounded p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{risk}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}