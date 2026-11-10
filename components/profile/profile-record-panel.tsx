'use client';

import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { CalendarDays, Camera, Check, Clock, Copy, KeyRound, PencilLine, Shield } from '@/components/ui/hugeicons';
import {
  RecordAvatar,
  RecordDetailAction,
  RecordDetailFooter,
  RecordDetailHeading,
  RecordDetailTiles,
  RecordPanel,
  RecordTileAction,
} from '@/components/dashboard/record-panel';
import type { User } from '@/types';

type ProfileSectionId = 'personal' | 'account' | 'security';

const PROFILE_SECTIONS: readonly ProfileSectionId[] = ['personal', 'account', 'security'];

/** El perfil se carga al entrar en la página: el usuario lo está usando ahora mismo. */
const LAST_SEEN_LABEL = 'Hace un momento';

interface ProfileFieldProps {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'tel' | 'password';
  disabled?: boolean;
  autoComplete?: string;
  wide?: boolean;
}

function ProfileField({ id, label, value, onChange, type = 'text', disabled, autoComplete, wide }: ProfileFieldProps) {
  return (
    <label className={wide ? 'profile-field is-wide' : 'profile-field'} htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

function IconAvatar({ children }: { children: ReactNode }) {
  return <span className="overview-person-avatar" aria-hidden="true">{children}</span>;
}

interface EditableSection {
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export interface ProfilePersonalForm extends EditableSection {
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}

export interface ProfilePasswordForm extends EditableSection {
  newPassword: string;
  confirmPassword: string;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
}

interface ProfileRecordPanelProps {
  user: User;
  roleLabel: string;
  memberSince: string;
  personal: ProfilePersonalForm;
  password: ProfilePasswordForm;
  avatarUploading: boolean;
  onAvatarSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  idCopied: boolean;
  onCopyId: () => void;
}

function EditActions({ section, saveLabel, savingLabel }: { section: EditableSection; saveLabel: string; savingLabel: string }) {
  return (
    <>
      <RecordDetailAction secondary onSelect={section.onCancel}>Cancelar</RecordDetailAction>
      <RecordDetailAction onSelect={section.onSave}>
        {section.saving ? savingLabel : saveLabel}<Check />
      </RecordDetailAction>
    </>
  );
}

/**
 * Perfil en una única tarjeta con el patrón del dashboard: secciones a la
 * izquierda y su detalle (y su edición) en el panel de la derecha.
 */
export function ProfileRecordPanel({
  user,
  roleLabel,
  memberSince,
  personal,
  password,
  avatarUploading,
  onAvatarSelected,
  idCopied,
  onCopyId,
}: ProfileRecordPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phoneLabel = user.phone || 'No indicado';

  const renderRow = (section: ProfileSectionId) => {
    if (section === 'personal') {
      return {
        avatar: <RecordAvatar name={user.name} src={user.avatar_url} />,
        title: user.name,
        subtitle: user.email,
        state: personal.editing ? 'Editando' : roleLabel,
      };
    }
    if (section === 'account') {
      return {
        avatar: <IconAvatar><Shield /></IconAvatar>,
        title: 'Detalles de cuenta',
        subtitle: `Desde ${memberSince}`,
        state: 'Activa',
      };
    }
    return {
      avatar: <IconAvatar><KeyRound /></IconAvatar>,
      title: 'Contraseña',
      subtitle: 'Seguridad de acceso',
      state: password.editing ? 'Editando' : undefined,
    };
  };

  const renderPersonal = () => (
    <>
      <RecordDetailHeading
        label="Información personal"
        title={user.name}
        badge={roleLabel}
        columns={[
          { label: 'Correo electrónico', primary: user.email },
          { label: 'Teléfono', primary: phoneLabel },
        ]}
      />
      {personal.editing ? (
        <div className="profile-form">
          <ProfileField id="profile-name" label="Nombre completo" value={personal.name} onChange={personal.onNameChange} autoComplete="name" />
          <ProfileField id="profile-phone" label="Teléfono" type="tel" value={personal.phone} onChange={personal.onPhoneChange} autoComplete="tel" />
          <ProfileField id="profile-email" label="Correo electrónico (no editable)" value={user.email} disabled wide />
        </div>
      ) : (
        <RecordDetailTiles
          tiles={[
            { icon: <Camera />, value: user.avatar_url ? 'Personalizada' : 'Sin foto', label: 'Foto de perfil' },
            { icon: <Shield />, value: roleLabel, label: 'Rol en FondosEG' },
            { icon: <CalendarDays />, value: memberSince, label: 'Miembro desde' },
          ]}
          action={
            <RecordTileAction
              label={avatarUploading ? 'Subiendo…' : 'Cambiar foto'}
              icon={<Camera />}
              onSelect={() => fileInputRef.current?.click()}
            />
          }
        />
      )}
      <RecordDetailFooter
        items={personal.editing ? [] : [
          { label: 'Nombre', value: user.name },
          { label: 'Teléfono', value: phoneLabel },
          { label: 'Estado', value: 'Activa' },
        ]}
        actions={personal.editing
          ? <EditActions section={personal} saveLabel="Guardar cambios" savingLabel="Guardando…" />
          : <RecordDetailAction onSelect={personal.onEdit}>Editar datos<PencilLine /></RecordDetailAction>}
      />
    </>
  );

  const renderAccount = () => (
    <>
      <RecordDetailHeading
        label="Detalles de cuenta"
        title="Cuenta FondosEG"
        badge="Activa"
        columns={[
          { label: 'ID de usuario', primary: <span className="profile-id">{user.id}</span> },
          { label: 'Correo de acceso', primary: user.email },
        ]}
      />
      <RecordDetailTiles
        tiles={[
          { icon: <CalendarDays />, value: memberSince, label: 'Miembro desde' },
          { icon: <Clock />, value: LAST_SEEN_LABEL, label: 'Última conexión' },
        ]}
      />
      <RecordDetailFooter
        items={[
          { label: 'Rol', value: roleLabel },
          { label: 'Estado', value: 'Activa' },
        ]}
        actions={
          <RecordDetailAction onSelect={onCopyId} label="Copiar ID de usuario">
            {idCopied ? 'ID copiado' : 'Copiar ID'}{idCopied ? <Check /> : <Copy />}
          </RecordDetailAction>
        }
      />
    </>
  );

  const renderSecurity = () => (
    <>
      <RecordDetailHeading
        label="Seguridad"
        title="Contraseña"
        badge={password.editing ? 'Editando' : undefined}
        columns={[
          { label: 'Correo de acceso', primary: user.email },
          { label: 'Última conexión', primary: LAST_SEEN_LABEL },
        ]}
      />
      {password.editing ? (
        <div className="profile-form">
          <ProfileField
            id="new-password"
            label="Nueva contraseña"
            type="password"
            value={password.newPassword}
            onChange={password.onNewPasswordChange}
            autoComplete="new-password"
          />
          <ProfileField
            id="confirm-password"
            label="Confirmar contraseña"
            type="password"
            value={password.confirmPassword}
            onChange={password.onConfirmPasswordChange}
            autoComplete="new-password"
          />
        </div>
      ) : (
        <p className="profile-note">
          Cambia tu contraseña si sospechas que alguien más la conoce. No la compartas
          con nadie, tampoco con administración.
        </p>
      )}
      <RecordDetailFooter
        items={password.editing ? [] : [
          { label: 'Método', value: 'Correo y contraseña' },
          { label: 'Estado', value: 'Protegida' },
        ]}
        actions={password.editing
          ? <EditActions section={password} saveLabel="Actualizar contraseña" savingLabel="Actualizando…" />
          : <RecordDetailAction onSelect={password.onEdit}>Cambiar contraseña<KeyRound /></RecordDetailAction>}
      />
    </>
  );

  const renderDetail = (section: ProfileSectionId) => {
    if (section === 'personal') return renderPersonal();
    if (section === 'account') return renderAccount();
    return renderSecurity();
  };

  return (
    <>
      <RecordPanel
        label="Mi perfil"
        title="Mi perfil"
        subtitle="Datos, cuenta y seguridad"
        items={PROFILE_SECTIONS}
        getId={(section) => section}
        renderRow={renderRow}
        renderDetail={renderDetail}
        listLabel="Seleccionar una sección del perfil"
        emptyList={null}
        emptyDetail={null}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={avatarUploading}
        onChange={onAvatarSelected}
      />
    </>
  );
}
