import React, { createContext, useContext } from "react";
import {
  Link as RRLink,
  NavLink,
  Outlet,
  useNavigate as useRRNavigate,
  useParams as useRRParams,
  useSearchParams,
} from "react-router-dom";

export { Outlet };

const RouteCtx = createContext<any>({});
export const RouteContextProvider = RouteCtx.Provider;

function substitute(to: string, params?: Record<string, any>) {
  if (!params) return to;
  let p = to;
  for (const [k, v] of Object.entries(params)) {
    p = p.replace(`$${k}`, encodeURIComponent(String(v)));
  }
  return p;
}

function buildPath(to: string, params?: any, search?: any) {
  let p = substitute(to, params);
  if (search && typeof search === "object") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (v != null) qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) p += `?${s}`;
  }
  return p;
}

export function Link(props: any) {
  const {
    to,
    params,
    search,
    activeOptions,
    activeProps,
    inactiveProps,
    children,
    className,
    asChild: _ac,
    ...rest
  } = props;
  const path = buildPath(to, params, search);
  if (activeProps || inactiveProps) {
    return (
      <NavLink
        to={path}
        end={!!activeOptions?.exact}
        className={({ isActive }) =>
          isActive ? activeProps?.className ?? "" : inactiveProps?.className ?? ""
        }
        {...rest}
      >
        {children}
      </NavLink>
    );
  }
  return (
    <RRLink to={path} className={className} {...rest}>
      {children}
    </RRLink>
  );
}

export function useNavigate() {
  const nav = useRRNavigate();
  return (opts: any) => {
    if (typeof opts === "string") return nav(opts);
    nav(buildPath(opts.to, opts.params, opts.search));
  };
}

export function useRouter() {
  const nav = useNavigate();
  return {
    navigate: (opts: any) => nav(opts),
    invalidate: () => {},
  };
}

export function redirect(opts: any) {
  const e: any = new Error("redirect");
  e.redirect = opts;
  return e;
}

function makeRouteObj(opts: any) {
  return {
    ...opts,
    component: opts.component,
    useParams: () => useRRParams() as any,
    useSearch: () => {
      const [sp] = useSearchParams();
      const obj: Record<string, any> = {};
      sp.forEach((v, k) => {
        const n = Number(v);
        obj[k] = Number.isFinite(n) && v !== "" ? n : v;
      });
      return obj;
    },
    useRouteContext: () => useContext(RouteCtx),
  };
}

export function createFileRoute(_path: string) {
  return (opts: any) => makeRouteObj(opts);
}

export function createRootRouteWithContext<_T = any>() {
  return (opts: any) => makeRouteObj(opts);
}

export const HeadContent = () => null;
export const Scripts = () => null;
