import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Download, Heart, LifeBuoy, LogOut, Plus, Tags, UserRound, Wallet as WalletIcon, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState } from '../components/ui'
import { networks, walletProviders, type LoginInput, type PasswordInput, type Profile, type ProfileInput, type RegisterInput, type Session, type Wallet, type WalletInput } from '../contracts'
import { api, ApiError } from '../lib/api'
import { keys } from '../lib/query'
import { acceptSession, safeRedirect, useSession } from '../lib/session'
import { HomePreview } from './catalog'
import { Failure, FeatureTitle, Feedback, Field, LoadingPanel, PasswordField, SelectField } from './commerce-ui'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  return <AuthForm redirect={redirect} />
}

export function RegisterPage() {
  const { redirect } = useSearch({ from: '/register' })
  return <AuthForm register redirect={redirect} />
}

function AuthForm({ register = false, redirect }: { register?: boolean; redirect?: string }) {
  const navigate = useNavigate()
  const [passwordError, setPasswordError] = useState('')
  const mutation = useMutation({
    mutationFn: (input: LoginInput | RegisterInput) => api.post<Session>(`/session/${register ? 'register' : 'login'}`, input),
    onSuccess: async (session) => {
      await acceptSession(session)
      await navigate({ href: safeRedirect(redirect), replace: true })
    },
  })
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email')).trim()
    const password = String(form.get('password'))
    if (register && form.get('confirmPassword') !== password) {
      setPasswordError('As senhas devem ser iguais.')
      event.currentTarget.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.focus()
      return
    }
    setPasswordError('')
    mutation.mutate(register ? { name: String(form.get('name')).trim(), email, password } : { email, password })
  }

  return <div className="commerce-auth-page">
    <div className="commerce-auth-backdrop" inert aria-hidden><HomePreview /></div>
    <div className="commerce-auth">
      <section className="commerce-card">
        <Link className="commerce-auth-close icon-button" to="/" aria-label="Fechar e voltar"><X size={19} aria-hidden /></Link>
        <p className="commerce-auth-brand">KURIO</p>
        <div className="commerce-auth-tabs">
          {register ? <Link className="commerce-auth-inactive-tab" to="/login" search={{ redirect }}>Entrar</Link> : <h1>Entrar</h1>}
          <span className="commerce-auth-inactive-tab" aria-hidden>|</span>
          {register ? <h1><span className="commerce-auth-desktop-title">Criar conta</span><span className="commerce-auth-mobile-title">Criar perfil de colecionador</span></h1>
            : <Link className="commerce-auth-inactive-tab" to="/register" search={{ redirect }}>Criar conta</Link>}
        </div>
        <p className="commerce-auth-description">{register ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.' : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}</p>
        <form onSubmit={submit} className="commerce-stack">
          {register && <Field name="name" label="Nome completo" placeholder="Nome de exibição" hideLabel autoComplete="name" required minLength={2} maxLength={100} error={fields?.name} />}
          <Field name="email" label="E-mail" placeholder={register ? 'Digite seu e-mail' : 'contato@email.com'} hideLabel type="email" autoComplete="email" required maxLength={254} error={fields?.email} />
          <PasswordField name="password" label="Senha" placeholder="Senha" hideLabel autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={128} required error={fields?.password} />
          {register && <Field name="confirmPassword" label="Confirmar senha" placeholder="Confirmar senha" hideLabel type="password" autoComplete="new-password" required error={passwordError} onChange={() => setPasswordError('')} />}
          {mutation.error && <Failure message={mutation.error.message} />}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (register ? 'Criando conta…' : 'Entrando…') : (register ? 'Criar conta' : 'Entrar')}
          </Button>
        </form>
        <div className="commerce-auth-social" aria-label="Login social indisponível nesta demonstração">
          <p>Ou continue com</p>
          <Button variant="secondary" disabled><span className="commerce-social-google" aria-hidden>G</span> Continuar com Google</Button>
          <Button variant="secondary" disabled><span className="commerce-social-facebook" aria-hidden>f</span> Continuar com Facebook</Button>
        </div>
          <p className="commerce-auth-note">
            {register ? <>Já tem uma conta? <Link to="/login" search={{ redirect }}>Entrar</Link></>
              : <>Novo na Kurio? <Link to="/register" search={{ redirect }}>Criar conta</Link></>}
          </p>
      </section>
    </div>
  </div>
}

export function AccountSidebar() {
  const logout = useMutation({ mutationFn: () => api.post<void>('/session/logout'), onSuccess: () => acceptSession(null) })
  return <aside className="commerce-account-sidebar">
    <h2>Meu perfil</h2>
    <nav aria-label="Minha conta">
      <Link to="/profile"><UserRound size={18} aria-hidden /> Dados do perfil</Link>
      <Link to="/wallets"><WalletIcon size={18} aria-hidden /> Carteiras</Link>
      <Link to="/activity"><Activity size={18} aria-hidden /> Atividade</Link>
      <Link to="/favorites"><Heart size={18} aria-hidden /> Lista de interesse</Link>
      <Link to="/offers"><Tags size={18} aria-hidden /> Ofertas</Link>
      <Link to="/downloads"><Download size={18} aria-hidden /> Arquivos baixados</Link>
      <Link to="/support"><LifeBuoy size={18} aria-hidden /> Suporte</Link>
      <Button variant="ghost" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={18} aria-hidden /> Sair</Button>
    </nav>
    {logout.isError && <Failure message={logout.error.message} />}
  </aside>
}

export function ProfilePage() {
  const session = useSession()
  return session ? <ProfileView key={session.user.id} scope={session.user.id} /> : null
}

function ProfileView({ scope }: { scope: string }) {
  const query = useQuery({ queryKey: keys.profile(scope), queryFn: ({ signal }) => api.get<Profile>('/profile', signal) })
  return <div className="container commerce-page commerce-account-layout">
    <AccountSidebar />
    <div className="commerce-profile">
    <FeatureTitle title="Perfil do colecionador" />
    {query.isPending && <LoadingPanel label="Carregando perfil" />}
    {query.isError && <Failure message={query.error.message} retry={() => { void query.refetch() }} />}
    {query.data && <div className="commerce-profile-columns">
      <ProfileForm key={query.data.id} profile={query.data} />
      <PasswordForm />
    </div>}
    </div>
  </div>
}

const avatarTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function fileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Arquivo inválido.'))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function ProfileForm({ profile }: { profile: Profile }) {
  const client = useQueryClient()
  const bioId = useId()
  const [draft, setDraft] = useState<ProfileInput>(profile)
  const [avatarError, setAvatarError] = useState('')
  const [readingAvatar, setReadingAvatar] = useState(false)
  const mutation = useMutation({
    mutationFn: (input: ProfileInput) => api.patch<Profile>('/profile', input),
    onSuccess: (saved) => {
      setDraft(saved)
      const session = client.getQueryData<Session | null>(keys.session)
      if (session?.user.id === saved.id) {
        client.setQueryData(keys.profile(saved.id), saved)
        client.setQueryData(keys.session, { ...session, user: saved })
      }
    },
  })
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : undefined

  async function selectAvatar(file: File | undefined) {
    setAvatarError('')
    if (!file) return
    if (!avatarTypes.includes(file.type) || file.size > 1_000_000) {
      setAvatarError('Selecione uma imagem PNG, JPEG, WebP ou GIF de até 1 MB.')
      return
    }
    setReadingAvatar(true)
    try {
      const avatar = await fileDataUrl(file)
      setDraft((previous) => ({ ...previous, avatar }))
      mutation.reset()
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Não foi possível ler a imagem.')
    } finally {
      setReadingAvatar(false)
    }
  }

  return <form className="commerce-card commerce-stack" onSubmit={(event) => {
    event.preventDefault()
    if (!mutation.isPending && !readingAvatar) {
      const { name, email, avatar, bio, username, ens, walletNickname } = draft
      mutation.mutate({ name: name.trim(), email: email.trim(), avatar, bio: bio.trim(), username: username?.trim(), ens: ens?.trim(), walletNickname: walletNickname?.trim() })
    }
  }}>
    <div className="commerce-profile-fields">
    <Field label="Nome completo" name="name" autoComplete="name" required minLength={2} maxLength={100} value={draft.name} error={fields?.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
    <Field label="Nome de usuário" name="username" autoComplete="username" maxLength={32} value={draft.username ?? ''} error={fields?.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
    <Field label="E-mail" name="email" autoComplete="email" type="email" required maxLength={254} value={draft.email} error={fields?.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
    <Field label="Nome ENS" name="ens" placeholder="nome.eth" maxLength={100} value={draft.ens ?? ''} error={fields?.ens} onChange={(event) => setDraft({ ...draft, ens: event.target.value })} />
    <Field label="Apelido da carteira" name="walletNickname" maxLength={60} value={draft.walletNickname ?? ''} error={fields?.walletNickname} onChange={(event) => setDraft({ ...draft, walletNickname: event.target.value })} />
    <div className="commerce-stack commerce-profile-avatar">
    <div className="commerce-actions">
      {draft.avatar ? <img className="commerce-avatar" alt="Avatar do colecionador" width={74} height={74} src={draft.avatar} />
        : <span className="commerce-avatar" aria-hidden>{draft.name.trim().slice(0, 2).toUpperCase()}</span>}
      {draft.avatar && <Button variant="ghost" type="button" onClick={() => {
        setDraft({ ...draft, avatar: null })
        setAvatarError('')
        mutation.reset()
      }}>Remover avatar</Button>}
    </div>
    <Field label="Avatar" name="avatar" type="file" accept={avatarTypes.join(',')} disabled={readingAvatar || mutation.isPending} error={avatarError || fields?.avatar} hint="Imagem de até 1 MB." onChange={(event) => {
      void selectAvatar(event.currentTarget.files?.[0])
      event.currentTarget.value = ''
    }} />
    </div>
    </div>
    <div className="commerce-field">
      <label htmlFor={bioId}>Sobre você</label>
      <textarea id={bioId} name="bio" rows={3} maxLength={280} value={draft.bio} aria-invalid={fields?.bio ? true : undefined} aria-describedby={fields?.bio ? `${bioId}-error` : undefined} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
      {fields?.bio && <span id={`${bioId}-error`} className="commerce-field-error">{fields.bio}</span>}
    </div>
    {mutation.error && <Failure message={mutation.error.message} />}
    {mutation.isSuccess && <Feedback success>Perfil atualizado.</Feedback>}
    <Button type="submit" disabled={mutation.isPending || readingAvatar}>{mutation.isPending ? 'Salvando…' : 'Salvar perfil'}</Button>
  </form>
}

function PasswordForm() {
  const [matchError, setMatchError] = useState('')
  const mutation = useMutation({ mutationFn: (input: PasswordInput) => api.put<void>('/profile/password', input) })
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const target = event.currentTarget
    const form = new FormData(target)
    const newPassword = String(form.get('newPassword'))
    if (form.get('confirmNewPassword') !== newPassword) {
      setMatchError('As senhas devem ser iguais.')
      target.querySelector<HTMLInputElement>('[name="confirmNewPassword"]')?.focus()
      return
    }
    setMatchError('')
    mutation.mutate({ currentPassword: String(form.get('currentPassword')), newPassword }, { onSuccess: () => target.reset() })
  }

  return <form className="commerce-card commerce-stack" onSubmit={submit}>
    <h2>Alterar senha</h2>
    <PasswordField label="Senha atual" name="currentPassword" autoComplete="current-password" required maxLength={128} error={fields?.currentPassword} />
    <PasswordField label="Nova senha" name="newPassword" autoComplete="new-password" required minLength={8} maxLength={128} hint="Use pelo menos 8 caracteres." error={fields?.newPassword} />
    <Field label="Confirmar nova senha" name="confirmNewPassword" type="password" autoComplete="new-password" required maxLength={128} error={matchError} onChange={() => setMatchError('')} />
    {mutation.error && <Failure message={mutation.error.message} />}
    {mutation.isSuccess && <Feedback success>Senha alterada.</Feedback>}
    <Button type="submit" variant="secondary" disabled={mutation.isPending}>{mutation.isPending ? 'Alterando…' : 'Alterar senha'}</Button>
  </form>
}

export function WalletsPage() {
  const session = useSession()
  return session ? <WalletsView key={session.user.id} scope={session.user.id} /> : null
}

function WalletsView({ scope }: { scope: string }) {
  const [saved, setSaved] = useState('')
  const query = useQuery({ queryKey: keys.wallets(scope), queryFn: ({ signal }) => api.get<Wallet[]>('/wallets', signal) })
  return <div className="container commerce-page commerce-account-layout">
    <AccountSidebar />
    <div className="commerce-wallets">
    <FeatureTitle title="Minhas carteiras" subtitle="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.">
      <WalletDialog scope={scope} onSaved={setSaved} />
    </FeatureTitle>
    <div className="commerce-stack">
      {saved && <Feedback success>{saved}</Feedback>}
      {query.isPending && <LoadingPanel label="Carregando carteiras" />}
      {query.isError && <Failure message={query.error.message} retry={() => { void query.refetch() }} />}
      {query.data?.length === 0 && <EmptyState title="Nenhuma carteira cadastrada" description="Adicione uma carteira para usar no pagamento." />}
      {query.data && [true, false].map((primary) => <section className="commerce-wallet-group" key={String(primary)}>
        <h2>{primary ? 'Carteira principal' : 'Carteira secundária'}</h2>
        {query.data.filter((wallet) => wallet.primary === primary).map((wallet) => <article className="commerce-card commerce-wallet" key={wallet.id}>
        <dl>
          <dt className="commerce-wallet-header"><WalletIcon size={18} aria-hidden /><strong>{wallet.name}</strong> <span className="commerce-pill">{wallet.primary ? 'Principal' : 'Secundária'}</span></dt>
          <dd>{wallet.address}</dd>
          <dd className="commerce-muted">{wallet.network}</dd>
        </dl>
        <WalletDialog wallet={wallet} scope={scope} onSaved={setSaved} />
        </article>)}
      </section>)}
    </div>
    </div>
  </div>
}

function WalletDialog({ scope, wallet, onSaved }: { scope: string; wallet?: Wallet; onSaved: (message: string) => void }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const mutation = useMutation({
    mutationFn: (input: WalletInput) => wallet ? api.put<Wallet>(`/wallets/${wallet.id}`, input) : api.post<Wallet>('/wallets', input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.wallets(scope) })
      onSaved(wallet ? 'Carteira atualizada.' : 'Carteira cadastrada.')
      setOpen(false)
    },
  })
  const fields = mutation.error instanceof ApiError ? mutation.error.fields : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending) return
    const form = new FormData(event.currentTarget)
    const network = networks.find((value) => value === form.get('network'))
    if (!network) return
    const value = (field: string) => String(form.get(field) ?? '').trim()
    mutation.mutate({
      name: value('name'), address: value('address'), network, primary: Boolean(wallet?.primary || form.get('primary')),
      provider: walletProviders.find((item) => item === form.get('provider')),
      displayName: value('displayName'), profileName: value('profileName'), referralCode: value('referralCode'),
      email: value('email'), ens: value('ens'), secondaryAddress: value('secondaryAddress'),
    })
  }

  return <Dialog open={open} onOpenChange={(next) => { if (!mutation.isPending) { mutation.reset(); setOpen(next) } }}>
    <DialogTrigger asChild>
      {wallet ? <Button variant="secondary" aria-label={`Editar carteira ${wallet.name}`}>Editar</Button>
        : <Button><Plus size={18} aria-hidden /> Adicionar carteira</Button>}
    </DialogTrigger>
    <DialogContent className="commerce-wallet-dialog">
      <DialogTitle>{wallet ? 'Editar carteira' : 'Adicionar carteira'}</DialogTitle>
      <DialogDescription>Use um endereço fictício no formato Ethereum.</DialogDescription>
      <form className="commerce-stack" onSubmit={submit}>
        <div className="commerce-profile-fields">
        <Field label="Nome de exibição" name="displayName" defaultValue={wallet?.displayName} maxLength={100} error={fields?.displayName} />
        <Field label="Nome da carteira" name="name" defaultValue={wallet?.name} required minLength={2} maxLength={60} error={fields?.name} />
        <SelectField label="Rede" name="network" defaultValue={wallet?.network ?? networks[0]}>{networks.map((network) => <option key={network}>{network}</option>)}</SelectField>
        <Field label="Nome do perfil" name="profileName" defaultValue={wallet?.profileName} maxLength={100} error={fields?.profileName} />
        <Field label="Endereço da carteira" name="address" defaultValue={wallet?.address} required maxLength={42} spellCheck={false} autoComplete="off" error={fields?.address} hint="0x seguido de 40 caracteres hexadecimais." />
        <Field label="Carteira secundária ou ENS" name="secondaryAddress" defaultValue={wallet?.secondaryAddress} maxLength={100} error={fields?.secondaryAddress} />
        <SelectField label="Tipo de carteira" name="provider" error={fields?.provider} defaultValue={wallet?.provider ?? walletProviders[0]}>{walletProviders.map((provider) => <option key={provider}>{provider}</option>)}</SelectField>
        <Field label="Código de indicação" name="referralCode" defaultValue={wallet?.referralCode} maxLength={40} error={fields?.referralCode} />
        <Field label="E-mail" name="email" type="email" defaultValue={wallet?.email} maxLength={254} error={fields?.email} />
        <Field label="Nome ENS" name="ens" placeholder="nome.eth" defaultValue={wallet?.ens} maxLength={100} error={fields?.ens} />
        </div>
        <label className="commerce-checkbox"><input type="checkbox" name="primary" defaultChecked={wallet?.primary} disabled={wallet?.primary} /> Definir como carteira principal</label>
        {mutation.error && <Failure message={mutation.error.message} />}
        <div className="commerce-actions commerce-actions-end">
          <DialogClose asChild><Button type="button" variant="secondary" disabled={mutation.isPending}>Cancelar</Button></DialogClose>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
