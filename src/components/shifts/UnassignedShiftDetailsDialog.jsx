import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, XCircle, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

export default function UnassignedShiftDetailsDialog({ shift, open, onOpenChange }) {
  if (!shift || shift.status !== 'בעיה') return null;

  const unassignmentDetails = shift.unassignment_details || [];
  const hasDetails = unassignmentDetails.length > 0;

  // סיווג סיבות
  const categorizedReasons = {};
  unassignmentDetails.forEach(detail => {
    detail.reasons?.forEach(reason => {
      if (!categorizedReasons[reason]) {
        categorizedReasons[reason] = [];
      }
      categorizedReasons[reason].push(detail.employee_name);
    });
  });

  const reasonIcons = {
    'לא זמין': '🚫',
    'בחופשה': '🏖️',
    'כבר משובץ': '📅',
    'חורג ממגבלת שבוע': '⚠️',
    'חורג ממגבלת חודש': '⚠️',
    'משמרת חסומה': '🔒',
    'יום חסום': '❌',
    'אילוץ קבוע': '🔄',
    'כבר עם 2 משמרות שישי': '📊',
    'כבר עשה שישי מסוג זה': '🔁',
    'כבר עם משמרת זהה השבוע': '📈',
    'עשה ארוכה בחמישי': '🌙',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            פרטי משמרת לא משובצת
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* פרטי המשמרת */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-red-600 mt-1" />
              <div className="flex-1">
                <div className="font-bold text-lg text-red-900 mb-2">
                  {format(new Date(shift.date + 'T00:00:00'), 'dd/MM/yyyy')} - {shift.shift_type}
                </div>
                {shift.start_time && shift.end_time && (
                  <div className="text-sm text-red-700">
                    שעות: {shift.start_time} - {shift.end_time}
                  </div>
                )}
                {shift.exception_reason && (
                  <div className="mt-2 text-sm bg-white bg-opacity-60 rounded p-2 text-red-800">
                    <strong>סיבה כללית:</strong> {shift.exception_reason}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* פירוט מלא */}
          {hasDetails ? (
            <>
              {/* סיכום לפי סיבות */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  📊 סיכום סיבות
                </h3>
                <div className="space-y-2">
                  {Object.entries(categorizedReasons).map(([reason, employees]) => (
                    <div key={reason} className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">{reasonIcons[reason] || '•'}</span>
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 mb-1">{reason}</div>
                          <div className="text-sm text-gray-700">
                            <Badge variant="secondary" className="mr-1">
                              {employees.length} עובדים
                            </Badge>
                            {employees.join(', ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* פירוט לפי עובד */}
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  פירוט מלא לפי עובד ({unassignmentDetails.length} עובדים)
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {unassignmentDetails.map((detail, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {detail.employee_name}
                      </div>
                      <div className="space-y-1">
                        {detail.reasons?.map((reason, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-2 text-sm text-gray-700">
                            <span>{reasonIcons[reason] || '•'}</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
              <XCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-yellow-800 font-medium">
                אין מידע מפורט זמין עבור משמרת זו
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                המשמרת לא שובצה, אך לא נאסף מידע מפורט על הסיבות
              </p>
            </div>
          )}

          {/* המלצות */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              💡 המלצות לפתרון
            </h3>
            <ul className="text-sm space-y-1 text-purple-900">
              <li>• בדוק אם ניתן לשנות הגדרות אילוצים או העדפות</li>
              <li>• שקול לאשר חריגה ידנית למשמרת זו</li>
              <li>• נסה לשנות את תאריך המשמרת או את סוגה</li>
              <li>• הוסף עובד נוסף לצוות אם יש מחסור כללי</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}