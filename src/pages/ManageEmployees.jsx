import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getMonth, getYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, ArrowRight, UserPlus, Search, CheckCircle2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function ManageEmployees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [quickLinkDialogOpen, setQuickLinkDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    active: true,
    contract_type: '08:00–17:00 / 10:00–19:00',
    notes: '',
    preferred_shift_times: [],
    blocked_shift_times: [],
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const year = getYear(new Date());
  const month = getMonth(new Date()) + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allShifts = [] } = useQuery({
    queryKey: ['shifts', monthKey],
    queryFn: async () => {
      const all = await base44.entities.Shift.list();
      return all.filter(s => s.date && s.date.startsWith(monthKey));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: async (newEmployee) => {
      await queryClient.invalidateQueries(['employees']);
      
      if (selectedUser) {
        try {
          await base44.entities.Employee.update(newEmployee.id, { user_id: selectedUser.id });
          await queryClient.invalidateQueries(['employees']);
          toast({ title: 'עובד נוסף וחובר בהצלחה' });
          setSelectedUser(null);
        } catch (error) {
          toast({ title: 'עובד נוסף אך החיבור נכשל', variant: 'destructive' });
        }
      } else {
        toast({ title: 'עובד נוסף בהצלחה' });
      }
      
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'עובד עודכן בהצלחה' });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'עובד נמחק בהצלחה' });
    },
  });

  const linkUserMutation = useMutation({
    mutationFn: ({ employeeId, userId }) => base44.entities.Employee.update(employeeId, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'משתמש חובר בהצלחה' });
      setLinkDialogOpen(false);
      setQuickLinkDialogOpen(false);
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: (email) => base44.users.inviteUser(email, 'user'),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast({ title: 'הזמנה נשלחה בהצלחה', description: 'העובד יקבל מייל עם קישור להרשמה' });
      setInviteDialogOpen(false);
      setInviteEmail('');
    },
    onError: (error) => {
      toast({ title: 'שגיאה בשליחת הזמנה', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      active: true,
      contract_type: '08:00–17:00 / 10:00–19:00',
      notes: '',
      preferred_shift_times: [],
      blocked_shift_times: [],
    });
    setEditingEmployee(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name,
      active: employee.active,
      contract_type: employee.contract_type,
      notes: employee.notes || '',
      preferred_shift_times: employee.preferred_shift_times || [],
      blocked_shift_times: employee.blocked_shift_times || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesActive = filterActive === 'all' || 
      (filterActive === 'active' && employee.active) || 
      (filterActive === 'inactive' && !employee.active);
    return matchesSearch && matchesActive;
  });

  const unlinkedUsers = users.filter(u => !employees.some(e => e.user_id === u.id));

  const getEmployeeShiftCount = (employeeId) => {
    return allShifts.filter(s => s.assigned_employee_id === employeeId).length;
  };

  const exportToExcel = () => {
    const data = filteredEmployees.map(emp => {
      const linkedUser = users.find(u => u.id === emp.user_id);
      const shiftCount = getEmployeeShiftCount(emp.id);
      return {
        'שם עובד': emp.full_name,
        'סטטוס': emp.active ? 'פעיל' : 'לא פעיל',
        'משמרות החודש': shiftCount,
        'אימייל משתמש': linkedUser?.email || 'לא מחובר',
        'סוג חוזה': emp.contract_type,
        'הערות': emp.notes || '',
        'משמרות מועדפות': emp.preferred_shift_times?.join(', ') || '',
        'משמרות חסומות': emp.blocked_shift_times?.join(', ') || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'עובדים');
    XLSX.writeFile(wb, `עובדים_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'הקובץ יוצא בהצלחה' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">ניהול עובדים</h1>
          <Link to={createPageUrl('ManagerDashboard')}>
            <Button variant="outline">
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה ללוח משמרות
            </Button>
          </Link>
        </div>

        {unlinkedUsers.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="bg-orange-200 rounded-full p-3 flex-shrink-0">
                <UserPlus className="w-8 h-8 text-orange-700" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-orange-900 mb-2">
                  ⚠️ {unlinkedUsers.length} משתמשים ממתינים לחיבור
                </h2>
                <p className="text-orange-800 mb-4 text-lg">
                  המשתמשים הבאים נרשמו למערכת. חבר כל אחד לרשומת העובד המתאימה:
                </p>
                <div className="space-y-3">
                  {unlinkedUsers.map(user => (
                    <div key={user.id} className="bg-white rounded-lg p-4 flex justify-between items-center shadow-md border-2 border-orange-200">
                      <div>
                        <div className="font-bold text-xl">{user.full_name}</div>
                        <div className="text-gray-600 text-lg">{user.email}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          נרשם: {new Date(user.created_date).toLocaleDateString('he-IL', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="lg"
                          onClick={() => {
                            const matchingEmp = employees.find(e => 
                              !e.user_id && e.full_name.toLowerCase() === (user.full_name?.toLowerCase() || '')
                            );
                            if (matchingEmp) {
                              linkUserMutation.mutate({ 
                                employeeId: matchingEmp.id, 
                                userId: user.id 
                              });
                            } else {
                              setSelectedUser(user);
                              setQuickLinkDialogOpen(true);
                            }
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          חיבור מהיר
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData({
                              full_name: user.full_name || user.email,
                              active: true,
                              contract_type: '08:00–17:00 / 10:00–19:00',
                              start_date: format(new Date(), 'yyyy-MM-dd'),
                              notes: '',
                              preferred_shift_times: [],
                              blocked_shift_times: [],
                            });
                            setDialogOpen(true);
                          }}
                        >
                          צור עובד חדש
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center flex-1">
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="חיפוש עובד לפי שם..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="active">פעילים</SelectItem>
                  <SelectItem value="inactive">לא פעילים</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportToExcel} variant="outline" size="lg">
                <Download className="w-4 h-4 ml-2" />
                ייצא לאקסל
              </Button>
              <Button onClick={() => setInviteDialogOpen(true)} variant="outline" size="lg">
                📧 הזמן עובד חדש
              </Button>
              <Button onClick={() => setDialogOpen(true)} size="lg">
                + הוסף עובד חדש
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם עובד</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-right">משמרות החודש</TableHead>
                <TableHead className="text-right">משתמש מחובר</TableHead>
                <TableHead className="text-right">סוג חוזה</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const linkedUser = users.find(u => u.id === employee.user_id);
                const shiftCount = getEmployeeShiftCount(employee.id);
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={employee.active ? 'default' : 'secondary'}>
                        {employee.active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{shiftCount}</Badge>
                        <span className="text-xs text-gray-500">משמרות</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {linkedUser ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{linkedUser.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">לא מחובר</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{employee.contract_type}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setSelectedEmployee(employee); setLinkDialogOpen(true); }}
                          title="חבר משתמש"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(employee)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(employee.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'עריכת עובד' : 'הוספת עובד חדש'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>שם עובד</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>פעיל</Label>
              </div>

              <div>
                <Label>סוג חוזה שעות</Label>
                <Select value={formData.contract_type} onValueChange={(value) => setFormData({ ...formData, contract_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00–17:00 / 10:00–19:00">08:00–17:00 / 10:00–19:00</SelectItem>
                    <SelectItem value="08:00–16:30 / 10:30–19:00">08:00–16:30 / 10:30–19:00</SelectItem>
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

              <div>
                <Label className="font-bold">שעות מועדפות לעובד</Label>
                <p className="text-xs text-gray-500 mb-2">
                  העובד יקבל קדימות במשמרות אלו
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['מסיים ב-17:30', 'מסיים ב-19:00', 'שישי קצר', 'שישי ארוך'].map(shiftType => (
                    <div key={`pref-${shiftType}`} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`pref-${shiftType}`}
                        checked={formData.preferred_shift_times.includes(shiftType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              preferred_shift_times: [...formData.preferred_shift_times, shiftType]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              preferred_shift_times: formData.preferred_shift_times.filter(t => t !== shiftType)
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <Label htmlFor={`pref-${shiftType}`} className="cursor-pointer text-sm">
                        {shiftType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="font-bold text-red-600">שעות חסומות לעובד</Label>
                <p className="text-xs text-gray-500 mb-2">
                  העובד לא ישובץ למשמרות אלו בשום מקרה
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {['מסיים ב-17:30', 'מסיים ב-19:00', 'שישי קצר', 'שישי ארוך'].map(shiftType => (
                    <div key={`block-${shiftType}`} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`block-${shiftType}`}
                        checked={formData.blocked_shift_times.includes(shiftType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              blocked_shift_times: [...formData.blocked_shift_times, shiftType]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              blocked_shift_times: formData.blocked_shift_times.filter(t => t !== shiftType)
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <Label htmlFor={`block-${shiftType}`} className="cursor-pointer text-sm">
                        {shiftType}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  ביטול
                </Button>
                <Button type="submit">
                  {editingEmployee ? 'עדכן' : 'הוסף'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>חיבור משתמש לעובד: {selectedEmployee?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">בחר משתמש שנרשם למערכת כדי לחבר אותו לרשומת העובד</p>
              <div className="space-y-2">
                {users.filter(u => !employees.some(e => e.user_id === u.id)).map(user => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => linkUserMutation.mutate({ employeeId: selectedEmployee.id, userId: user.id })}
                  >
                    <div className="text-right">
                      <div className="font-medium">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </Button>
                ))}
                {users.filter(u => !employees.some(e => e.user_id === u.id)).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">אין משתמשים זמינים לחיבור</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={quickLinkDialogOpen} onOpenChange={setQuickLinkDialogOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>חיבור משתמש: {selectedUser?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <p className="text-gray-700">
                לא נמצאה התאמה אוטומטית לעובד קיים. בחר אחת מהאפשרויות הבאות:
              </p>

              <div className="space-y-4">
                <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                  <h3 className="font-bold text-lg mb-2">אפשרות 1: צור רשומת עובד חדשה</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    יצירת רשומת עובד חדשה עם הפרטים של {selectedUser?.full_name} וחיבור אוטומטי למשתמש
                  </p>
                  <Button 
                    className="w-full"
                    onClick={() => {
                      setFormData({
                        full_name: selectedUser.full_name || selectedUser.email,
                        active: true,
                        contract_type: '08:00–17:00 / 10:00–19:00',
                        notes: '',
                        preferred_shift_times: [],
                        blocked_shift_times: [],
                      });
                      setQuickLinkDialogOpen(false);
                      setDialogOpen(true);
                    }}
                  >
                    צור עובד חדש וחבר אוטומטית
                  </Button>
                </div>

                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                  <h3 className="font-bold text-lg mb-2">אפשרות 2: חבר לעובד קיים</h3>
                  <p className="text-sm text-gray-600 mb-3">בחר עובד מהרשימה לחיבור ידני:</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {employees.filter(e => !e.user_id).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        אין עובדים ללא משתמש מקושר
                      </p>
                    ) : (
                      employees.filter(e => !e.user_id).map(emp => (
                        <Button
                          key={emp.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            linkUserMutation.mutate({ 
                              employeeId: emp.id, 
                              userId: selectedUser.id 
                            });
                            setQuickLinkDialogOpen(false);
                            setSelectedUser(null);
                          }}
                        >
                          <div className="text-right">
                            <div className="font-medium">{emp.full_name}</div>
                            <div className="text-sm text-gray-500">
                              {emp.contract_type} • {emp.active ? 'פעיל' : 'לא פעיל'}
                            </div>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setQuickLinkDialogOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>הזמן עובד חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                הזן כתובת אימייל ונשלח לעובד הזמנה להצטרף למערכת
              </p>
              <div>
                <Label>כתובת אימייל</Label>
                <Input
                  type="email"
                  placeholder="example@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setInviteDialogOpen(false);
                    setInviteEmail('');
                  }}
                >
                  ביטול
                </Button>
                <Button
                  onClick={() => {
                    if (inviteEmail) {
                      inviteUserMutation.mutate(inviteEmail);
                    }
                  }}
                  disabled={!inviteEmail || inviteUserMutation.isPending}
                >
                  {inviteUserMutation.isPending ? 'שולח...' : 'שלח הזמנה'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}