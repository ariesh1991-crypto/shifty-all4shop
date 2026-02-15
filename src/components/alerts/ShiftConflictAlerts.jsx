import React from 'react';
import { AlertTriangle, Calendar, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default function ShiftConflictAlerts({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;

  const severityColors = {
    'critical': 'bg-red-100 border-red-500 text-red-900',
    'warning': 'bg-amber-100 border-amber-500 text-amber-900',
    'info': 'bg-blue-100 border-blue-500 text-blue-900',
  };

  const severityIcons = {
    'critical': '🔴',
    'warning': '⚠️',
    'info': 'ℹ️',
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className={`p-4 rounded-lg border-2 ${severityColors[alert.severity] || severityColors.warning}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{severityIcons[alert.severity]}</span>
                <span className="font-bold">{alert.title}</span>
                <Badge variant="outline" className="text-xs">
                  {alert.severity === 'critical' ? 'קריטי' : 
                   alert.severity === 'warning' ? 'אזהרה' : 'מידע'}
                </Badge>
              </div>
              <p className="text-sm mb-2">{alert.message}</p>
              
              {alert.details && (
                <div className="mt-3 p-2 bg-white bg-opacity-50 rounded text-xs space-y-1">
                  {alert.details.employee && (
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      <span>עובד: {alert.details.employee}</span>
                    </div>
                  )}
                  {alert.details.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>תאריך: {alert.details.date}</span>
                    </div>
                  )}
                  {alert.details.shift && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>משמרת: {alert.details.shift}</span>
                    </div>
                  )}
                  {alert.details.reason && (
                    <div className="text-xs mt-2 font-medium">
                      סיבה: {alert.details.reason}
                    </div>
                  )}
                </div>
              )}

              {alert.suggestions && alert.suggestions.length > 0 && (
                <div className="mt-3 p-3 bg-white bg-opacity-70 rounded">
                  <div className="font-bold text-xs mb-2">💡 הצעות לפתרון:</div>
                  <ul className="text-xs space-y-1">
                    {alert.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={() => onDismiss(idx)}
                className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}