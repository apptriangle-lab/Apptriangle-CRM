import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { hrApi, HRInfoDto, notificationsApi, NotificationDto } from "@/lib/api";

interface AppContextType {
  hrInfo: HRInfoDto | null;
  notifications: NotificationDto[];
  unreadCount: number;
  refreshHrInfo: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hrInfo, setHrInfo] = useState<HRInfoDto | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshHrInfo = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await hrApi.get(user.id);
      setHrInfo(data);
    } catch (error) {
      console.error("Failed to fetch HR info:", error);
    }
  }, [user?.id]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await notificationsApi.list({ limit: 20 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.delete(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  }, [notifications]);

  // Initial load on login or refresh
  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      Promise.all([refreshHrInfo(), refreshNotifications()]).finally(() => {
        setIsLoading(false);
      });

      // Polling for notifications remains here
      const interval = setInterval(refreshNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      setHrInfo(null);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id, refreshHrInfo, refreshNotifications]);

  return (
    <AppContext.Provider
      value={{
        hrInfo,
        notifications,
        unreadCount,
        refreshHrInfo,
        refreshNotifications,
        markAsRead,
        markAllRead,
        deleteNotification,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be inside AppProvider");
  return ctx;
};
