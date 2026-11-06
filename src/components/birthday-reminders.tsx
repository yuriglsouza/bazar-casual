"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { birthdayReminders } from "@/lib/analytics";
import { localDate } from "@/lib/finance";

type BirthdayCustomer = { id: string; name: string; birthDate: string | null; isActive: boolean };

export function BirthdayReminders({ customers }: { customers: BirthdayCustomer[] }) {
  const [showAll, setShowAll] = useState(false);
  const today = localDate();
  const birthdays = birthdayReminders(customers, today);
  const visibleBirthdays = showAll ? birthdays : birthdays.slice(0, 5);
  const month = new Date(`${today.slice(0, 7)}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
  const upcoming = birthdays.filter((customer) => customer.daysAway >= 0);
  return <section className="birthday-card" aria-labelledby="birthday-title">
    <div className="birthday-heading"><span className="birthday-icon"><Gift size={22} /></span><div><p className="eyebrow">Lembrete do bazar</p><h2 id="birthday-title">Aniversários de {month}</h2></div><span className="birthday-count">{birthdays.length}</span></div>
    {birthdays.length ? <><div className="birthday-list">{visibleBirthdays.map((customer) => <div className={customer.daysAway === 0 ? "birthday-row birthday-today" : "birthday-row"} key={customer.id}><span><strong>{customer.name}</strong><small>{new Date(`${customer.birthDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</small></span><b>{customer.daysAway === 0 ? "Hoje! 🎉" : customer.daysAway === 1 ? "Amanhã" : customer.daysAway > 1 ? `Em ${customer.daysAway} dias` : "Já passou"}</b></div>)}</div>{birthdays.length > 5 && <button type="button" className="text-button birthday-expand" onClick={() => setShowAll(!showAll)}>{showAll ? "Mostrar menos" : `Ver todos (${birthdays.length})`}</button>}{upcoming.length === 0 && <p className="birthday-note">Todos os aniversários deste mês já passaram.</p>}</> : <p className="birthday-note">Nenhuma cliente com aniversário cadastrado neste mês.</p>}
  </section>;
}
