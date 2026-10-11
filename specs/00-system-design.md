## Overview

This platform is a comprehensive legal assistance and fleet safety solution designed for drivers, attorneys, dispatchers, and general users. Drivers can access real-time GPS navigation, route optimization, safety monitoring, emergency SOS features, detention alerts, and instant legal assistance from nearby attorneys. Attorneys profiles will be managed by the admins and admin can create case and assign attornys there, Dispatchers and fleet administrators can monitor driver locations, track trips, optimize routes, manage incidents, and analyze fleet performance through a centralized dashboard. General users can search for attorneys, access legal resources, receive emergency alerts, and request assistance when needed. A powerful Super Admin web portal provides complete control over user management, fleet operations, attorney verification, emergency response coordination, content management, analytics, subscriptions, and system settings. The platform aims to improve driver safety, streamline legal support, and enhance operational efficiency through real-time communication, tracking, and emergency response capabilities.

## Techstacks

- Redis (For caching and pipelines)
- PostgreSQL (Main database)
- Prisma (ORM)
- NestJS (Backend framework)

## Sub - Roles (Users)

- Driver <> They can sign up and sign in and check routes as well.
- Organization <> Some user created an organization and can manage drivers and routes.
- Admin <> They can manage organizations and drivers.
- Attorney <> They will be added by admins and they can be assigned to any case.


## Notes 
- Attornys doesn't have any clinet or interaction with the platform yet. they will be added by admins.
- Cases will be controlled by admins and there status as well.
- Drivers will have a vault to upload there legel docs to ensure that docouments can get used wherever we can make them usefull.



## TOPICS

Some topics that will help us to build the platform for relibally.

# ROLES
Lets keep two role, ADMIN and USER. Admin can add more admins, and they will have a Maintainer model initialized with keyed permission levels such as `{ "system.user": 3 }`.

# SIGNUP
Provider can signup and also driver as well, driver sigup will provide name,email,password,vinNumber and licnecePlate and from provider dashboard and admin dashboard they both can add driver and from admin dashboard we can even add provider as well 


# Subscription & Plans
We are going with stripe with proper webhook pipelines, and currently the payment is only about subscription and about the plan -
    > Plan records will be able to be modified by admins
    > If a plan already bought by someone then we will create a new plan instead of editing old one
    > Old plan will get deprecated and it will be only showing for details only
    > We will add driver count restriction based on there tier


# Provider

Provider can check all the drivers and where they are and we will be showing all in maps. provider doesn't have much of functionalities since the admin will be controlling everything about it.

# Driver 
Driver can send sos, driver can upload files to vault and driver can add some contacts that will be messages on sos.
About the assignments - 
      > Provider can also search for a driver and add them on the org and fleet
      > A driver can exists in multiple org and fleet.


# Attornys
They are just a record of the platform and admin is adding them and asssignning then cases.
