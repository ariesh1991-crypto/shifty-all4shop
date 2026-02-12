import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { LogOut, Clock } from 'lucide-react';

const UserNotRegisteredError = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        setIsAdmin(user.role === 'admin');
        
        // שלח התראה למנהלים שמשתמש חדש נרשם
        if (user.role !== 'admin') {
          // שלח התראות לכל המנהלים
          const allUsers = await base44.entities.User.list();
          const admins = allUsers.filter(u => u.role === 'admin');
          
          for (const admin of admins) {
            // בדוק אם כבר שלחנו התראה למנהל הזה
            const existingNotifications = await base44.entities.Notification.list();
            const alreadyNotified = existingNotifications.some(
              n => n.user_id === admin.id && 
                   n.type === 'new_user_pending' && 
                   n.message.includes(user.email)
            );
            
            if (!alreadyNotified) {
              await base44.entities.Notification.create({
                user_id: admin.id,
                type: 'new_user_pending',
                title: 'משתמש חדש ממתין לחיבור',
                message: `${user.full_name || user.email} נרשם למערכת וממתין שתחבר אותו לרשומת עובד`,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  // מנהלים מקבלים גישה ישירה למערכת גם בלי חיבור לעובד
  if (isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6" dir="rtl">
      <div className="max-w-2xl w-full p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Clock className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">חשבונך ממתין לחיבור</h1>
          <p className="text-gray-600 mb-6 text-lg">
            נרשמת בהצלחה! המנהל יחבר את חשבונך לרשומת העובד שלך בקרוב.
          </p>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-right">
            <p className="font-bold mb-3 text-lg">מה קורה עכשיו?</p>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>המנהל קיבל התראה על ההרשמה שלך</li>
              <li>הוא יחבר את חשבונך ({currentUser?.email}) לרשומת העובד שלך במערכת</li>
              <li>לאחר החיבור תוכל להיכנס ולנהל את האילוצים וההעדפות שלך</li>
            </ol>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              <strong>לידיעתך:</strong> המנהל מקבל התראה אוטומטית כאשר אתה נרשם. 
              אם זה לוקח זמן, אפשר ליצור איתו קשר ולהזכיר לו לחבר אותך בדף "ניהול עובדים".
            </p>
          </div>
          <Button onClick={() => base44.auth.logout()} variant="outline" size="lg">
            <LogOut className="w-4 h-4 ml-2" />
            יציאה
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
