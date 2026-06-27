import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Plus, Link2, Link2Off, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { appointmentsApi, type CalendarEvent } from '@/api/appointments.api';
import { toast } from '@/hooks/use-toast';
import { EventDialog } from './EventDialog';
import { cn } from '@/lib/utils';

// Google Calendar color map
const GOOGLE_COLORS: Record<string, string> = {
  '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
  '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
  '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
};

function getEventColor(event: CalendarEvent): string {
  return event.colorId ? (GOOGLE_COLORS[event.colorId] || '#5484ed') : '#5484ed';
}

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState(() =>
    new URLSearchParams(window.location.search).get('connected') === 'true'
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true' || params.get('error')) {
      window.history.replaceState({}, '', '/appointments');
    }
    if (params.get('error')) {
      const err = params.get('error');
      toast({
        variant: 'destructive',
        title: err === 'google_auth_denied' ? 'Verbindung abgebrochen' : 'Google Verbindung fehlgeschlagen',
      });
    }
  }, []);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['appointments', 'status'],
    queryFn: () => appointmentsApi.getStatus(),
    retry: false,
  });

  const isConnected = statusData?.data.connected ?? false;

  const { data: calendarsData, isLoading: calendarsLoading } = useQuery({
    queryKey: ['appointments', 'calendars'],
    queryFn: () => appointmentsApi.listCalendars(),
    enabled: showCalendarPicker && isConnected,
  });

  const selectCalendarMutation = useMutation({
    mutationFn: (calendarId: string) => appointmentsApi.selectCalendar(calendarId),
    onSuccess: () => {
      setShowCalendarPicker(false);
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Kalender verbunden' });
    },
  });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const timeMin = viewMode === 'week' ? weekStart.toISOString() : monthStart.toISOString();
  const timeMax = viewMode === 'week' ? weekEnd.toISOString() : monthEnd.toISOString();

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['appointments', 'events', timeMin, timeMax],
    queryFn: () => appointmentsApi.listEvents({ timeMin, timeMax }),
    enabled: isConnected,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', 'events'] });
      toast({ title: 'Termin gelöscht' });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => appointmentsApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Google Calendar getrennt' });
    },
  });

  const handleConnect = async () => {
    try {
      const res = await appointmentsApi.getAuthUrl();
      window.location.href = res.data.url;
    } catch {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Verbindung zu Google konnte nicht gestartet werden' });
    }
  };

  const handleSlotClick = (date: Date, hour?: number) => {
    const start = new Date(date);
    if (hour !== undefined) start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    setSelectedSlot({ start: start.toISOString(), end: end.toISOString() });
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setSelectedSlot(null);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setSelectedSlot(null);
  };

  // Calendar picker — shown after OAuth callback
  if (!statusLoading && isConnected && showCalendarPicker) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Termine</h1>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Kalender auswählen
            </CardTitle>
            <CardDescription>
              Wählen Sie den Google Kalender, der mit WerkstattClone synchronisiert werden soll.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {calendarsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Kalender werden geladen...
              </div>
            ) : (
              calendarsData?.data.map((cal) => (
                <button
                  key={cal.id}
                  className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => selectCalendarMutation.mutate(cal.id)}
                  disabled={selectCalendarMutation.isPending}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cal.backgroundColor || '#5484ed' }}
                    />
                    <span className="text-sm font-medium">{cal.summary}</span>
                  </div>
                  {cal.primary && <Badge variant="secondary">Primär</Badge>}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not connected state
  if (!statusLoading && !isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Termine</h1>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Google Calendar verbinden
            </CardTitle>
            <CardDescription>
              Verbinden Sie Ihren Google Kalender, um Termine direkt in WerkstattClone zu verwalten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span> Termine erstellen, bearbeiten und löschen
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span> Synchronisierung mit Google Kalender auf allen Geräten
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span> Farbcodierung nach Mitarbeiter oder Priorität
              </li>
            </ul>
            <Button onClick={handleConnect} className="w-full">
              <Link2 className="mr-2 h-4 w-4" />
              Mit Google Calendar verbinden
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00–19:00
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (date: Date) => {
    if (!events?.data) return [];
    return events.data.filter((event) => {
      const eventDate = event.start.dateTime
        ? parseISO(event.start.dateTime)
        : event.start.date
        ? parseISO(event.start.date)
        : null;
      return eventDate && isSameDay(eventDate, date);
    });
  };

  const getEventTop = (event: CalendarEvent): number => {
    if (!event.start.dateTime) return 0;
    const date = parseISO(event.start.dateTime);
    return (date.getHours() - 7) * 60 + date.getMinutes();
  };

  const getEventHeight = (event: CalendarEvent): number => {
    if (!event.start.dateTime || !event.end.dateTime) return 60;
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    return Math.max(30, (end.getTime() - start.getTime()) / 60000);
  };

  const navigatePrev = () =>
    setCurrentDate((d) => (viewMode === 'week' ? subWeeks(d, 1) : new Date(d.getFullYear(), d.getMonth() - 1, 1)));

  const navigateNext = () =>
    setCurrentDate((d) => (viewMode === 'week' ? addWeeks(d, 1) : new Date(d.getFullYear(), d.getMonth() + 1, 1)));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Termine</h1>
          <Badge variant="outline" className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-success inline-block" />
            Google Calendar
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnectMutation.mutate()}
            className="text-muted-foreground"
          >
            <Link2Off className="mr-1 h-3 w-3" /> Trennen
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('week')}
          >
            Woche
          </Button>
          <Button
            variant={viewMode === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('month')}
          >
            Monat
          </Button>
          <Button
            onClick={() => {
              setEditingEvent(null);
              setSelectedSlot(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Neuer Termin
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={navigatePrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Heute
        </Button>
        <Button variant="outline" size="icon" onClick={navigateNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium">
          {viewMode === 'week'
            ? `${format(weekStart, 'd. MMM', { locale: de })} – ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`
            : format(currentDate, 'MMMM yyyy', { locale: de })}
        </span>
        {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Week View */}
      {viewMode === 'week' && (
        <Card>
          <CardContent className="p-0 overflow-auto">
            <div className="flex">
              {/* Time column */}
              <div className="w-16 shrink-0 border-r">
                <div className="h-12 border-b" />
                {hours.map((h) => (
                  <div key={h} className="h-[60px] border-b px-2 pt-1 text-xs text-muted-foreground">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className="flex-1 min-w-[120px] border-r last:border-r-0">
                    {/* Day header */}
                    <div
                      className={cn(
                        'h-12 border-b px-2 flex flex-col justify-center cursor-pointer hover:bg-muted/50',
                        isToday && 'bg-primary/5'
                      )}
                      onClick={() => handleSlotClick(day)}
                    >
                      <span className="text-xs text-muted-foreground">{format(day, 'EEE', { locale: de })}</span>
                      <span className={cn('text-sm font-medium', isToday && 'text-primary')}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Time slots with events overlay */}
                    <div className="relative">
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="h-[60px] border-b hover:bg-muted/20 cursor-pointer"
                          onClick={() => handleSlotClick(day, h)}
                        />
                      ))}
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs text-white cursor-pointer overflow-hidden hover:opacity-90 transition-opacity"
                          style={{
                            backgroundColor: getEventColor(event),
                            top: `${getEventTop(event)}px`,
                            height: `${getEventHeight(event)}px`,
                            minHeight: '20px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                        >
                          <div className="font-medium truncate">{event.summary || '(kein Titel)'}</div>
                          {event.start.dateTime && (
                            <div className="opacity-80">
                              {format(parseISO(event.start.dateTime), 'HH:mm')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <Card>
          <CardContent className="p-0">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid — 6 weeks × 7 days */}
            <div className="grid grid-cols-7">
              {(() => {
                const firstDay = startOfWeek(monthStart, { weekStartsOn: 1 });
                return Array.from({ length: 42 }, (_, i) => addDays(firstDay, i)).map((day, idx) => {
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const isToday = isSameDay(day, new Date());
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'min-h-[100px] border-r border-b last:border-r-0 p-1 cursor-pointer hover:bg-muted/20',
                        !isCurrentMonth && 'opacity-40',
                        isToday && 'bg-primary/5'
                      )}
                      onClick={() => handleSlotClick(day)}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium inline-flex w-6 h-6 items-center justify-center rounded-full',
                          isToday && 'bg-primary text-primary-foreground'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="space-y-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="text-xs rounded px-1 text-white truncate cursor-pointer"
                            style={{ backgroundColor: getEventColor(event) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                          >
                            {event.summary || '(kein Titel)'}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} mehr</div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      <EventDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        event={editingEvent}
        defaultSlot={selectedSlot}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}
