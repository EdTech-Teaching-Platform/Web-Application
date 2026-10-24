import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBell, IconClose } from "./icons";
import { notificationsApi } from "../services/notificationsApi";
import { useRpc } from "../hooks/useRpc";
import "./NotificationsPanel.css";

export default function NotificationsPanel({ variant = "page" }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const listRequest = useCallback(() => notificationsApi.list({ page, size: variant === "dropdown" ? 5 : 10 }), [page, variant]);
  const list = useRpc(listRequest);
  const [unread, setUnread] = useState(0);
  const refresh = () => { list.refetch().catch(() => {}); notificationsApi.myUnreadCount().then(setUnread).catch(() => {}); };
  useEffect(() => { notificationsApi.myUnreadCount().then(setUnread).catch(() => {}); }, [list.data]);
  const mark = async (id) => { await notificationsApi.markRead(id); refresh(); };
  const markAll = async () => { await notificationsApi.markAllRead(); refresh(); };
  const items = list.data?.rows || [];
  return <div className={`ul-notifpanel ul-notifpanel--${variant}`} role={variant === "dropdown" ? "dialog" : undefined}>
    <div className="ul-notifpanel__head"><div><p className="ul-notifpanel__title">Notifications</p><p className="ul-notifpanel__subtitle">{unread ? `${unread} unread` : "You're all caught up"}</p></div><button type="button" className="ul-notifpanel__mark-all" onClick={markAll} disabled={!unread}>Mark all read</button></div>
    {list.error ? <div className="ul-notifpanel__empty">Unable to load notifications. <button type="button" onClick={refresh}>Retry</button></div> : list.loading ? <div className="ul-notifpanel__empty">Loading…</div> : !items.length ? <div className="ul-notifpanel__empty"><IconBell size={20} /><p>No notifications yet.</p></div> : <div className="ul-notifpanel__list scrollbar-thin">{items.map((n) => <div key={n.id} className={`ul-notifpanel__item${n.read_at ? "" : " is-unread"}`}><button type="button" className="ul-notifpanel__item-main" onClick={() => mark(n.id)}><span className="ul-notifpanel__icon"><IconBell size={15} /></span><span className="ul-notifpanel__body"><span className="ul-notifpanel__item-title">{n.title}</span><p className="ul-notifpanel__message">{n.body}</p><p className="ul-notifpanel__time">{n.when_label || n.created_at}</p>{n.action_url && <span className="ul-notifpanel__view" onClick={(e) => { e.stopPropagation(); mark(n.id).then(() => navigate(n.action_url)); }}>View details</span>}</span></button><button type="button" className="ul-notifpanel__remove" aria-label="Archive notification" onClick={() => notificationsApi.archive(n.id).then(refresh)}><IconClose size={13} /></button></div>)}</div>}
    {items.length > 0 && <div className="ul-usr-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={items.length < (variant === "dropdown" ? 5 : 10)} onClick={() => setPage(page + 1)}>Next</button></div>}
  </div>;
}
