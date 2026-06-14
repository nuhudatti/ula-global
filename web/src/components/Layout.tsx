import { useEffect, useState } from 'react';

import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

import { api } from '../lib/api';

import type { StudentAccess } from '../lib/suggestions';

import { InstitutionBrand } from './InstitutionBrand';
import { InstitutionPublicBanner } from './InstitutionPublicBanner';
import { useBranding } from '../context/BrandingContext';

import { UserProfileChip } from './UserProfileChip';
import { performSignOut } from '../lib/signOut';
import { useTenantPaths } from '../hooks/useTenantPaths';

import '../styles/institution-brand.css';



export function Layout() {

  const { user, logout } = useAuth();

  const { department } = useBranding();

  const navigate = useNavigate();
  const location = useLocation();
  const paths = useTenantPaths();

  const [canContribute, setCanContribute] = useState(false);

  const publicBannerRoutes = [paths.home, paths.login, paths.register];
  const showPublicBanner = publicBannerRoutes.includes(location.pathname);
  const publicBannerVariant =
    location.pathname === paths.login || location.pathname === paths.register ? 'hero' : 'compact';



  useEffect(() => {

    if (user?.role !== 'STUDENT') {

      setCanContribute(false);

      return;

    }

    api<StudentAccess>('/api/suggestions/student/access')

      .then((a) => setCanContribute(a.canContribute))

      .catch(() => setCanContribute(false));

  }, [user?.id, user?.role]);



  return (

    <>

      <header className="ula-shell-nav fixed top-0 left-0 right-0 z-50 px-4 md:px-6 flex items-center justify-between gap-4">

        <InstitutionBrand variant="shell" asLink linkTo={paths.home} className="min-w-0 shrink-0" />



        <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">

          <Link to={paths.home} className="ula-shell-link text-[13px] font-medium hover:text-dark-900">

            Browse

          </Link>

          {user?.role === 'SUPER_ADMIN' && (

            <Link

              to="/admin"

              className="ula-shell-link text-[13px] font-medium text-primary-800 hover:text-primary-900"

            >

              Platform admin

            </Link>

          )}

          {user?.role === 'FACULTY_ADMIN' && (

            <Link

              to="/faculty"

              className="ula-shell-link text-[13px] font-medium text-[#0f4c81] hover:text-[#0c3d66]"

            >

              Faculty workspace

            </Link>

          )}

          {user?.role === 'LECTURER' && (

            <Link

              to="/lecturer"

              className="ula-shell-link text-[13px] font-medium text-primary-700 hover:text-primary-800"

            >

              Lecturer workspace

            </Link>

          )}

          {(user?.role === 'HOD' || user?.role === 'DEPARTMENT_ADMIN') && (

            <Link

              to="/department"

              className="ula-shell-link text-[13px] font-medium text-[#0f4c81] hover:text-[#0c3d66]"

            >

              Department workspace

            </Link>

          )}

          {canContribute && (

            <Link

              to="/contribute"

              className="ula-shell-link text-[13px] font-medium text-[#0f4c81] hover:text-[#0c3d66]"

            >

              Contribute

            </Link>

          )}

          {user ? (

            <Link to="/settings" className="ula-shell-link text-[13px] font-medium hover:text-dark-900">

              Settings

            </Link>

          ) : null}

        </nav>



        <div className="flex items-center gap-2 shrink-0">

          <nav className="flex lg:hidden items-center gap-4 mr-2 text-[13px] font-medium text-dark-600">

            {user?.role === 'SUPER_ADMIN' && (

              <Link to="/admin" className="whitespace-nowrap text-primary-800">

                Admin

              </Link>

            )}

            {user?.role === 'FACULTY_ADMIN' && (

              <Link to="/faculty" className="whitespace-nowrap text-[#0f4c81]">

                Faculty

              </Link>

            )}

          {user?.role === 'LECTURER' && (

              <Link to="/lecturer" className="whitespace-nowrap">

                Upload

              </Link>

            )}

            {(user?.role === 'HOD' || user?.role === 'DEPARTMENT_ADMIN') && (

              <Link to="/department" className="whitespace-nowrap text-[#0f4c81]">

                Department

              </Link>

            )}

            {canContribute && (

              <Link to="/contribute" className="whitespace-nowrap text-[#0f4c81]">

                Contribute

              </Link>

            )}

          </nav>

          {user ? (

            <>

              <div className="hidden sm:block">

                <UserProfileChip

                  name={user.fullName}

                  subtitle={
                    user.role === 'LECTURER' || user.role === 'STUDENT'
                      ? department?.name ?? user.department?.name
                      : undefined
                  }

                  imageUrl={user.profilePhotoUrl}

                  compact

                  priority

                />

              </div>

              <button

                type="button"

                className="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50"

                onClick={() => performSignOut(logout, navigate, user)}

              >

                Sign out

              </button>

            </>

          ) : (

            <>

              <Link

                to={paths.login}

                state={{ from: location.pathname }}

                className="rounded-lg border border-dark-200 bg-white px-3 py-2 text-sm font-medium text-dark-700 hover:bg-dark-50"

              >

                Sign in

              </Link>

              <Link to={paths.register} className="btn-ula-primary px-4 py-2 text-sm shadow-sm rounded-lg inline-block">

                Register

              </Link>

            </>

          )}

        </div>

      </header>



      <div className="pt-[var(--ula-nav-h)] min-h-screen bg-[var(--ula-bg)]">
        {showPublicBanner ? <InstitutionPublicBanner variant={publicBannerVariant} /> : null}
        <Outlet />
      </div>

    </>

  );

}


