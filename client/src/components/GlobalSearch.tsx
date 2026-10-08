import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listArbitrators } from '../api/arbitrators';
import { listCases } from '../api/cases';
import { listAllDocuments } from '../api/documents';
import { listParties } from '../api/parties';
import { useAuth } from '../context/AuthContext';

interface ResultItem {
  key: string;
  label: string;
  sublabel?: string;
  to: string;
}

interface ResultGroup {
  type: string;
  items: ResultItem[];
}

const DEBOUNCE_MS = 300;
const MAX_PER_GROUP = 5;

export function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = user?.role === 'admin' || user?.role === 'registrar' || user?.role === 'staff';

  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setGroups([]);
      setOpen(false);
      setHighlighted(-1);
      return;
    }

    const timer = setTimeout(() => {
      // Cases and documents are visible to every role (each already scoped
      // server-side to what that account can see); arbitrators and parties
      // are staff-only, matching the role gates on their /arbitrators and
      // /parties routes.
      const requests: Promise<ResultGroup>[] = [
        listCases({ q, perPage: MAX_PER_GROUP }).then((page) => ({
          type: 'Cases',
          items: page.data.map((c) => ({
            key: `case-${c.id}`,
            label: c.case_number,
            sublabel: c.project?.name ?? c.category,
            to: `/cases/${c.id}`,
          })),
        })),
        listAllDocuments(q).then((docs) => ({
          type: 'Documents',
          items: docs.slice(0, MAX_PER_GROUP).map((d) => ({
            key: `doc-${d.publicId}`,
            label: d.fileName,
            sublabel: d.caseNumber,
            to: d.caseId ? `/cases/${d.caseId}` : '/documents',
          })),
        })),
      ];

      if (isStaff) {
        requests.push(
          listArbitrators(q).then((arbitrators) => ({
            type: 'Arbitrators',
            items: arbitrators.slice(0, MAX_PER_GROUP).map((a) => ({
              key: `arb-${a.id}`,
              label: a.full_name,
              sublabel: a.current_position ?? undefined,
              to: `/arbitrators/${a.id}`,
            })),
          })),
          // Parties have no detail route of their own yet - link back to
          // the register rather than a dead per-record page.
          listParties(q).then((parties) => ({
            type: 'Parties',
            items: parties.slice(0, MAX_PER_GROUP).map((p) => ({
              key: `party-${p.id}`,
              label: p.full_name,
              sublabel: p.organizations?.name,
              to: '/parties',
            })),
          })),
        );
      }

      Promise.all(requests).then((results) => {
        setGroups(results.filter((g) => g.items.length > 0));
        setOpen(true);
        setHighlighted(-1);
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, isStaff]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const flatItems = groups.flatMap((g) => g.items);

  function goTo(item: ResultItem) {
    setOpen(false);
    setQuery('');
    navigate(item.to);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatItems.length === 0) return;
      setOpen(true);
      setHighlighted((h) => (h + 1) % flatItems.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatItems.length === 0) return;
      setOpen(true);
      setHighlighted((h) => (h <= 0 ? flatItems.length - 1 : h - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted >= 0 && highlighted < flatItems.length) {
        goTo(flatItems[highlighted]);
      } else if (query.trim()) {
        setOpen(false);
        navigate(`/cases?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  let runningIndex = -1;

  return (
    <div ref={containerRef} className="relative ml-auto w-[250px] max-w-[40vw]">
      <label className="flex items-center gap-9 border-b border-rule h-[30px] w-full">
        <span className="font-mono text-9.5 tracking-[0.12em] text-muted-2">FIND</span>
        <input
          type="text"
          role="combobox"
          aria-expanded={open && groups.length > 0}
          aria-controls="global-search-listbox"
          aria-activedescendant={highlighted >= 0 ? `global-search-option-${highlighted}` : undefined}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => groups.length > 0 && setOpen(true)}
          placeholder="Case number, party or project"
          className="border-0 bg-transparent outline-none text-13 w-full text-ink"
        />
      </label>

      {open && groups.length > 0 && (
        <div
          id="global-search-listbox"
          role="listbox"
          aria-label="Search results"
          className="absolute top-[36px] right-0 w-[340px] max-w-[80vw] bg-sheet border border-ink shadow-lg z-10 max-h-[70vh] overflow-y-auto"
        >
          {groups.map((group) => (
            <div key={group.type} role="group" aria-label={group.type}>
              <div className="px-14 py-6 bg-band font-mono text-9.5 tracking-[0.12em] text-muted uppercase border-b border-hairline">
                {group.type}
              </div>
              {group.items.map((item) => {
                runningIndex += 1;
                const index = runningIndex;
                return (
                  <button
                    key={item.key}
                    id={`global-search-option-${index}`}
                    role="option"
                    aria-selected={highlighted === index}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goTo(item)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={`w-full text-left px-14 py-9 border-0 border-b border-hairline cursor-pointer flex flex-col gap-2 ${
                      highlighted === index ? 'bg-row-hover' : 'bg-transparent'
                    }`}
                  >
                    <span className="text-13 text-ink">{item.label}</span>
                    {item.sublabel && <span className="text-11 text-muted-2">{item.sublabel}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
