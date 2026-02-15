import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import EmployeePreferences from '../components/preferences/EmployeePreferences';
import NotificationBell from '../components/notifications/NotificationBell';

export default function EmployeePreferencesPage() {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['employees']);
      toast({ title: 'העדפות נשמרו בהצלחה! 🎉' });
    },
  });

  const handleSave = (preferences) => {
    updateEmployeeMutation.mutate({
      id: currentEmployee.id,
      data: preferences,
    });
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{currentEmployee.full_name} - העדפות מתקדמות</h1>
          <div className="flex gap-2">
            {currentUser && <NotificationBell userId={currentUser.id} />}
            <Link to={createPageUrl('EmployeeConstraints')}>
              <Button variant="outline">
                <ChevronRight className="w-4 h-4 ml-2" />
                חזרה לאילוצים
              </Button>
            </Link>
            <Button onClick={() => base44.auth.logout()} variant="outline">
              <LogOut className="w-4 h-4 ml-2" />
              יציאה
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            <strong>💡 טיפ:</strong> ההעדפות שלך ישפיעו על השיבוץ האוטומטי. המערכת תנסה לכבד את ההעדפות אך לא מובטח ש-100% מהבקשות תמלאנה.
          </p>
        </div>

        <EmployeePreferences employee={currentEmployee} onSave={handleSave} />
      </div>
    </div>
  );
}