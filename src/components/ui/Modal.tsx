import Link from "next/link";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  description?: string;
  closeHref: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal({ title, description, closeHref, children, footer }: ModalProps) {
  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title" id="modal-title">
              {title}
            </div>
            {description ? <div className="card-subtitle">{description}</div> : null}
          </div>
          <Link className="icon-btn" href={closeHref} aria-label="Tutup modal">
            <X size={16} />
          </Link>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
