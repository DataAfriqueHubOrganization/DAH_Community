import type { HelpContent } from "./types";

/** Help page content (English). Same topics and ids as content.fr.ts. */
export const helpEn: HelpContent = {
  topics: [
    {
      id: "profil", audience: "everyone", group: "account",
      title: "My profile and account",
      summary: "Photo, bio, skills, password, deleting your account.",
      link: { href: "/profile", label: "Open My profile" },
      blocks: [
        { type: "list", items: [
          "**Photo, bio, skills, links** (LinkedIn, GitHub, website): click what you want to change, then save.",
          "**Experience and certifications**: “Add” buttons in each block.",
          "**Password**: at the bottom of My profile. Forgotten? Use “Forgot password?” on the sign-in page: the link is valid for 24 hours and works once.",
          "**Delete my account**: at the bottom of My profile. Deletion is permanent.",
        ] },
      ],
    },
    {
      id: "candidature", audience: "candidate", group: "account",
      title: "My application",
      summary: "Becoming a Data Afrique Hub member.",
      blocks: [
        { type: "steps", items: [
          "If you have not yet done so, click **Join** on the website and fill in the application form.",
          "The team reviews your application. You get the answer by email.",
          "Once accepted, you become a **Member**: your member number is assigned automatically and new items appear in your menu (My department, My points, My contributions, My card).",
        ] },
        { type: "p", text: "Meanwhile, you can register for events from the website's **Events** page. If you already registered with the same email, the form fills itself in." },
      ],
    },
    {
      id: "annuaire", audience: "member", group: "account",
      title: "Appearing in the public directory",
      summary: "Your profile stays hidden until you turn it on.",
      link: { href: "/profile#visibilite", label: "Set my visibility" },
      blocks: [
        { type: "p", text: "The website lists the members who wish it in a public directory, to showcase the community and your skills to partners." },
        { type: "table", head: ["", "What it covers"], rows: [
          ["Shown if you turn it on", "name, photo, role, department, skills, bio, experience, certifications, links"],
          ["Never shown", "email, phone, CV"],
        ] },
        { type: "p", text: "Turn **Appear in the public directory** on or off in My profile, at any time." },
      ],
    },
    {
      id: "carte", audience: "member", group: "member",
      title: "My member card",
      summary: "Download, print or share your card.",
      link: { href: "/member-card", label: "Open My card" },
      blocks: [
        { type: "p", text: "Your card shows your member number, position and joining date. **Download** saves it for printing; **Share** copies its link. No number yet means your membership is not validated yet." },
      ],
    },
    {
      id: "taches", audience: "member", group: "member",
      title: "My tasks",
      summary: "Track, submit and get your tasks validated.",
      link: { href: "/my-department", label: "Open My department" },
      blocks: [
        { type: "p", text: "**My department** has three tabs: **My tasks**, **Projects** and **Team**. When a task is assigned to you, you get a “New task” email." },
        { type: "steps", items: [
          "In **My tasks**, read the description (“Show more” to see it in full).",
          "Set your progress: To do, In progress or Blocked.",
          "When done, click **Submit**. Add a note or a link for your lead if needed.",
          "Your lead **validates** the task (you earn the points) or **sends it back** with what is left to fix: fix it, then submit again.",
        ] },
        { type: "table", head: ["Size", "Points"], rows: [["Small", "5"], ["Medium", "10"], ["Large", "20"]] },
        { type: "note", text: "+20% if handed in before the due date, −25% if late, +25% for outstanding work. Points count in the month the task is handed in." },
      ],
    },
    {
      id: "points-etape", audience: "member", group: "member",
      title: "Check-ins",
      summary: "The short monthly review sent by your lead.",
      link: { href: "/my-points", label: "Open My points" },
      blocks: [
        { type: "p", text: "It is not an evaluation: it is a chance to say how your involvement is going and what could be improved." },
        { type: "steps", items: [
          "In **My points**, click **Fill in** next to “A check-in is waiting for you”.",
          "Rate yourself from 1 to 5 on five criteria, then answer the two questions.",
          "Send it. You can edit your answers until your lead replies.",
          "Your lead confirms and sends you feedback. A check-in is worth up to 20 points.",
        ] },
      ],
    },
    {
      id: "points", audience: "member", group: "member",
      title: "My points",
      summary: "Your points for the month, quarter or year.",
      link: { href: "/my-points", label: "Open My points" },
      blocks: [
        { type: "p", text: "Your points come from validated tasks, check-ins and paid contributions. You also find the history and your leads' feedback there." },
      ],
    },
    {
      id: "cotisations", audience: "contributor", group: "member",
      title: "My contributions",
      summary: "Declaring a payment with its proof.",
      link: { href: "/my-contributions", label: "Open My contributions" },
      blocks: [
        { type: "callout", title: "Why your contribution matters",
          text: "Data Afrique Hub lives thanks to its members. Your contribution directly funds what the community gives you:",
          items: [
            "the platform, website and emails you use every day;",
            "events, workshops and trainings, often free for participants;",
            "community projects and hackathons, where you build your skills;",
            "the community's presence with partners, which opens opportunities for its members.",
          ],
          footer: "500 FCFA a month is 6,000 FCFA a year: little for each of us, but together contributions let the community grow without relying only on sponsors. Every income and expense is recorded in the cash book by the treasury. And each paid month also earns you 5 points." },
        { type: "table", head: ["You are", "Monthly contribution"], rows: [
          ["Member", "500 FCFA"],
          ["Department lead or board member", "1,000 FCFA"],
        ] },
        { type: "p", text: "You can pay one month, a period or the whole year." },
        { type: "steps", items: [
          "Pay by Mobile Money or bank transfer.",
          "In **My contributions**, click **Declare a payment**.",
          "Tick the months paid and attach a screenshot of the proof (JPG, PNG or WebP, 5 MB max).",
          "Click **Send for validation**. The treasury checks and validates: you get a receipt by email.",
        ] },
        { type: "note", text: "A reminder may be sent in the last ten days of the month if the month is neither paid nor declared." },
      ],
    },
    {
      id: "gestionnaire", audience: "projectManager", group: "department",
      title: "Project manager",
      summary: "Creating the department's projects and assigning tasks.",
      link: { href: "/my-department", label: "Open My department" },
      blocks: [
        { type: "p", text: "Your lead made you a project manager. You organise the work, but you do not validate tasks: validation and points stay with the lead." },
        { type: "steps", items: [
          "**Projects → New project**: title, description, status, due date, repository link if needed.",
          "Open the project, then **Assign a task**: describe it with the editor (bold, lists, links), pick the person, due date and size.",
          "Save: the person gets an email with the description and a link to their tasks.",
        ] },
        { type: "note", text: "The pencil next to a task lets you edit or reassign it. Your rights end if you leave the department or the lead removes them." },
      ],
    },
    {
      id: "responsable", audience: "lead", group: "department",
      title: "Department lead",
      summary: "Team, project managers, task validation, check-ins.",
      link: { href: "/my-department", label: "Open My department" },
      blocks: [
        { type: "p", text: "The lead and co-lead run their department with four tabs: **Overview**, **Projects**, **Team** and **Check-ins**. They manage every project of the department, including those created by others." },
        { type: "list", items: [
          "**Team → Add a member**; **End membership** when someone leaves the department.",
          "**Project managers** (top of the Team tab): pick a member, then **Add**. They create projects and assign tasks, without validating them.",
          "**Validate a task**: the orange “To validate” group → **Validate** (tick “Outstanding work” for +25%) or **Send back** with what is left to do. Nobody validates their own task.",
          "**Check-ins → Start a check-in**: month reviewed, deadline, members. Then **Read and confirm**: adjust the scores (only yours count) and send feedback.",
          "**Ranking**: the most involved members of your department.",
        ] },
      ],
    },
    {
      id: "evenements", audience: "section:events", group: "management",
      title: "Events",
      summary: "Create, publish, follow registrations, send reminders.",
      link: { href: "/manage/events", label: "Open Events" },
      blocks: [
        { type: "list", items: [
          "**Create**: New event → title, dates, place or link, image, speakers. Draft or publish.",
          "**Registrations**: the count shows on each event; the list exports to Excel.",
          "**Reminder to registrants**: pick a template (before / after the event), adjust, send yourself a test, then send.",
          "**All participants**: by period or for chosen events, exportable.",
        ] },
      ],
    },
    {
      id: "membres", audience: "section:members", group: "management",
      title: "Members",
      summary: "The full member directory.",
      link: { href: "/manage/members", label: "Open Members" },
      blocks: [
        { type: "p", text: "Browse all members and their profiles. Changing roles and deleting accounts remain reserved to the administrator." },
      ],
    },
    {
      id: "departements", audience: "section:departments", group: "management",
      title: "Departments",
      summary: "Creating departments and naming their leads.",
      link: { href: "/manage/departments", label: "Open Departments" },
      blocks: [
        { type: "p", text: "Create, rename or delete a department and name its lead and co-lead. You can open every department, with the same options as a lead." },
      ],
    },
    {
      id: "actualites", audience: "section:news", group: "management",
      title: "News",
      summary: "Writing, scheduling and moderating articles.",
      link: { href: "/manage/actualites", label: "Open News" },
      blocks: [
        { type: "p", text: "Write an article with the editor, pick a category and an image, then save as draft, publish or schedule it. You can delete inappropriate comments." },
      ],
    },
    {
      id: "emails", audience: "section:emails", group: "management",
      title: "Emails to members",
      summary: "Writing to one or several members.",
      link: { href: "/manage/emails", label: "Open Emails" },
      blocks: [
        { type: "steps", items: [
          "Pick a template: announcement, meeting notice, call for volunteers, congratulations or free message.",
          "Pick the recipients: members one by one, or a group (everyone, board, leads, a department).",
          "Write: {prénom} and {nom} are replaced for each recipient. Add an action button if needed.",
          "**Send me a test**, check it, then send.",
        ] },
        { type: "note", text: "Each person gets their own email, without seeing other addresses. Follow progress in **History** and resend to failures if needed. Sending is blocked if it exceeds the daily email quota." },
      ],
    },
    {
      id: "tresorerie", audience: "section:treasury", group: "management",
      title: "Treasury",
      summary: "Validating payments, reminders, the cash book.",
      link: { href: "/treasury", label: "Open Treasury" },
      blocks: [
        { type: "list", items: [
          "**To validate**: payments declared with their proof. Check the amount, then **Validate** or **Reject** with a reason. The member gets a receipt and their points.",
          "**Members**: who paid which month. In the last ten days of the month, **Send the reminder** notifies those who neither paid nor declared (once a month). A member's file lets you record a payment received directly.",
          "**Cash book**: the association's income and expenses, separate from contributions.",
        ] },
        { type: "note", text: "Each new declaration is notified to you by email." },
      ],
    },
    {
      id: "classement", audience: "section:ranking", group: "management",
      title: "Community ranking",
      summary: "Member of the month, of the year, point adjustments.",
      link: { href: "/ranking", label: "Open Ranking" },
      blocks: [
        { type: "p", text: "The ranking of the whole community, by month, quarter or year. The medal icon on a row names the **member of the month** or **of the year**. You can correct a member's points: a reason is required and stays on record." },
      ],
    },
    {
      id: "candidatures", audience: "section:applications", group: "management",
      title: "Applications",
      summary: "Reviewing membership applications.",
      link: { href: "/memberships", label: "Open Applications" },
      blocks: [
        { type: "p", text: "Open an application (with the CV), then accept or reject it. The applicant is notified by email; once accepted, they become a member. You get an email for every new application." },
      ],
    },
    {
      id: "acces", audience: "admin", group: "admin",
      title: "Access management",
      summary: "Granting sections, naming an administrator.",
      link: { href: "/manage/access", label: "Open Access management" },
      blocks: [
        { type: "steps", items: [
          "Search for the member, or filter on “With access”.",
          "Tick the sections they can manage, then **Save access**. The change is immediate.",
        ] },
        { type: "list", items: [
          "Only active members receive sections; a member who goes back to applicant or visitor loses them.",
          "**Make administrator** gives access to everything, including Access management: grant it sparingly. You cannot remove your own role or the last administrator.",
          "In **Members**, the administrator changes a user's role, position and department, deactivates or deletes an account.",
        ] },
      ],
    },
  ],
  faq: [
    { audience: "everyone", q: "I don't receive the emails.", a: "Check your spam folder, then your account address in My profile." },
    { audience: "everyone", q: "An item disappeared from my menu.", a: "The administrator changed your access. Ask them if you need it for your role." },
    { audience: "candidate", q: "When will I know if my application is accepted?", a: "As soon as it is reviewed: the answer comes by email, and your menu grows if it is accepted." },
    { audience: "contributor", q: "My payment doesn't show.", a: "A declaration stays “Pending” until the treasury validates it. If rejected, the reason is shown in My contributions." },
    { audience: "member", q: "My task was sent back.", a: "Read the reason under the task, fix it, then click Submit again." },
    { audience: "member", q: "I can't see my department.", a: "You are not attached to any department yet. Ask a lead to add you." },
    { audience: "member", q: "My profile is not on the website.", a: "It is hidden by default: turn on “Appear in the public directory” in My profile." },
    { audience: "lead", q: "A member can't see their task.", a: "Check that it is assigned to them and that they are still in the department (Team tab)." },
  ],
};
