distutils_add_cython_module(cython${PYTHON_VERSION}_rados
  rados
  ${CMAKE_CURRENT_SOURCE_DIR}/rados.pyx
  ${PYTHON_VERSION})
add_dependencies(cython${PYTHON_VERSION}_rados rados)
distutils_install_cython_module(cython${PYTHON_VERSION}_rados
  ${PYTHON_VERSION})
