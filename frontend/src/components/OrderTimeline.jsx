export default function OrderTimeline({ events = [], label = 'Order status history' }) {
  return <ol className="order-timeline" aria-label={label}>
    {events.map((event, index) => {
      const status = String(event.to_status || '').replaceAll('_', ' ');
      const actor = event.actor_name || (event.actor_type === 'admin' ? 'Store team' : event.actor_type === 'customer' ? 'You' : '');
      return <li className="order-timeline-event" key={`${event.to_status}-${event.created_at}-${index}`}>
        <span className="order-timeline-marker" aria-hidden="true">{index + 1}</span>
        <div><strong>{status.charAt(0).toUpperCase() + status.slice(1)}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>{actor && <small>{actor}</small>}{event.note && <small>{event.note}</small>}</div>
      </li>;
    })}
    {!events.length && <li className="order-timeline-empty">No status updates are available.</li>}
  </ol>;
}
